---
title: Migrate to yarn berry zero-install
date: '2021-10-19T00:00:00.121Z'
layout: post
draft: false
category: 'Retrospective'
description: 'yarn berry zero-install로 마이그레이션 과정에서 밟았던 문제들과 해결한 방법을 공유'
---

과거 경험을 빗대어 보았을 때 `node_modules`로 인해 밟았던 의존성 관련 고통들에서 벗어나고 yarn berry의 PnP, zero-install로 인한 이득을 제품에 적용해보고자 호시탐탐 기회를 노리고 있었다. 그 계기는 [node modules로부터 우리를 구원해 줄 yarn berry](https://toss.tech/article/node-modules-and-yarn-berry)와 [원티드의 yarn berry 적용기](https://medium.com/wantedjobs/yarn-berry-%EC%A0%81%EC%9A%A9%EA%B8%B0-2-%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8-%EC%A0%81%EC%9A%A9%EA%B8%B0-45f1ba67c24c)를 읽고 나서였고 최근에 좋은 기회가 찾아왔다.

yarn berry로 마이그레이션하는 과정은 [Migration | Yarn](https://yarnpkg.com/getting-started/migration)문서에 잘 나와있고,
이 과정에서 겪었던 문제와 해결했던 방법을 기록차 적어놓고자 한다.

---

## 문제 1: `node_modules` 경로를 직접 참조하고 있는 패키지들

회사의 개발팀 규모가 갑자기 커지는 바람에 개발 컨벤션에 대한 이슈가 라이징되었다. 일일이 하나하나 토론식으로 정하다보면 얘기가 끝나지 않을 것 같아 [근택님](https://wiki.lucashan.space/)께서 [gts](https://github.com/google/gts)라는 녀석을 도입하면 어떨까 제안을 주셨다.

yarn v1에서는 문제없이 잘 동작했지만 마이그레이션하는 과정 중 문제가 생겼다. `gts`는 현재 로컬에 존재하는 tsconfig의 extends를 넣어준다. 아래는 gts에 의해 덮어씌워진 tsconfig의 예시이다.

```json
{
  "extends": "./node_modules/gts/tsconfig-google.json",
  "compilerOptions": {
    "target": "ES5",
    "rootDir": ".",
    "outDir": "build",
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "lib": ["dom", "dom.iterable", "esnext"]
  },
  "include": ["src"]
}
```

`tsconfig.json`을 보며 `node_modules`를 제거한 상황에서 `extends` 경로에 있는 파일을 어떻게 참조하게 만들 수 있을지 고민이였다.
가장 먼저 떠오른 방법은 gts를 사용하지 않는 것이였다. 하지만 산발적으로 관리되는 각종 컨벤션들을 통일시키고 싶었고 원인이 무엇인지 짚고 넘어가고자 선택지로 두지 않았다.
두 번째 방법은 라이브러리를 패치하는 것인데, 결국 이 방식을 채택했고 이 과정에서 세 가지 규칙을 정했다.

1. 패치한 라이브러리는 yarn berry 만을 지원한다. (npm이나 yarn v1을 쓸거면 gts를 사용해도 무방하다 생각했다.)
2. 빨리 실험해보고 적용해보기 위해서 gts의 코드 수정을 최소화한다.
3. gts 패키지는 초기화 과정에서 강제로 unplug를 수행하고, `node_modules`를 통해 참조하고 있던 것을 unplug가 있는 곳으로 변경한다.

[yarn unplug](https://yarnpkg.com/cli/unplug)는 zip으로 묶인 패키지를 `.yarn/unplugged` 하위에 unpacking 해주기 때문에 파일 경로를 통해 접근할 수 있게 될 것으로 기대했고, 각종 설정 파일들을 덮어씌울 때 `node_modules`가 아닌 unplugged된 새로운 경로를 잡아주었다.

```js
function init() {
  ...
  if (isYarnUsed()) {
    await execa('yarn', ['unplug', '@futureseller/gts'])

    const gtsUnpluggedDir = getGtsUnpluggedDir()
    const optionsWithUnpluggedDir = {
      ...options,
      targetDir: gtsUnpluggedDir,
    }

    await generateTsConfig(optionsWithUnpluggedDir)
    await generateESLintConfig(optionsWithUnpluggedDir)
    await generateESLintIgnore(optionsWithUnpluggedDir)
    await generatePrettierConfig(optionsWithUnpluggedDir)
  }
}
```

만들어놓고 나중에 알게된 사실인데 unplugged 디렉토리내의 gts 모듈의 경로를 직접 가져오는 함수를 짰는데, 내부 툴을 만드는 겸 Rescript를 찍먹해보려다보니 [yarn-plugin-rescript](https://github.com/reason-seoul/yarn-plugin-rescript)를 사용하게 되었다. (글을 쓰면서 공식 문서를 읽어보니 역시 문서에도 존재한다. 역시 문서를 잘 읽어봐야한다.) 플러그인의 코드를 읽어보니 `@yarnpkg/plugin-pnp`에 `getUnpluggedPath`와 같은 유틸이 있음을 알게되었다. `getGtsUnpluggedDir`을 해당 유틸로 교체할 예정이다.

설정을 가져오는 것 외에 `gts` 코드 내에도 `node_modules` 경로를 사용하고 있어서 아래와 같이 패치했다.

```patch
case 'check': {
  try {
-    await execa('node', ['./node_modules/eslint/bin/eslint', ...flags], {
+    await execa('yarn', ['eslint' ...flags], {
      stdio: 'inherit',
    });
    return true;
  } catch (e) {
    return false;
  }
}
```

겸사겸사 `stylelint` 규칙들도 강제해버릴까 고민하고 있었는데 고쳐야할 영역이 많아지다보니 `gts` 비스무리 한 것을 그냥 새로 작성할까 생각 중이다.

## 문제 2: Emotion: Running multiple instances may cause problems.

이 문제를 겪게된 구성은 다음과 같다. `admin-project`라는 리액트로 작성된 레포지토리가 있고 `@futureseller/design-system` 패키지를 설치해서 사용한다. 이 패키지는
`chakra-ui`를 래핑하여 몇몇 컴포넌트들을 다른 프로젝트에서도 함께 사용하기 위해 만든 것이다. 사실 모노레포로 갔다면 좋았겠지만 녹록치 않은 현실의 사정이 있었다.

각 프로젝트의 packge.json은 아래와 같다.

```json
{
  "name": "admin-project",
  "dependencies": {
    "@chakra-ui/react": "^1.6.6",
    "@emotion/is-prop-valid": "^1.1.0",
    "@emotion/react": "^11",
    "@emotion/styled": "^11",
    "@futureseller/design-system": "^2.0.0"
  }
}
```

```json
{
  "name": "@futureseller/design-system",
  "dependencies": {
    "@chakra-ui/react": "^1.6.6",
    "@emotion/is-prop-valid": "^1.1.0",
    "@emotion/react": "^11",
    "@emotion/styled": "^11"
  }
}
```

이 구성으로 앱을 실행하면 기존에는 문제가 없었다. 왜냐하면 `node_modules`가 의존성들을 resolve할 때 호이스팅했기 때문이다. `yarn why`를 통해 `@emotion/react`가 호이스팅되고 있음을 확인할 수 있었다.

```bash
$ yarn why @emotion/react
=> Found "@emotion/react@11.4.1"
info Has been hoisted to "@emotion/react"
info Reasons this module exists
  - Specified in "dependencies"
  - Hoisted from "@futureseller#design-system#@emotion#react"
...
```

마이그레이션 과정 중 앱을 실행하니 렌더링이 되지 않는 에러가 발생했다. 사실 이 부분에서 갈피를 못잡고 있던 와중에, 함께 삽질하고 계시던 [근택님](https://wiki.lucashan.space/)께서 아래와 같은 warning이 발생하고 있다는 것을 언급해주셨다.

> You are loading @emotion/react when it is already loaded. Running multiple instances may cause problems. This can happen if multiple versions are used, or if multiple builds of the same version are used.

말그대로 `mulpitle instances`가 존재한다는 것이였고 `.pnp.js`를 살펴보니 아래와 같았다.

```js
["@emotion/react", [
  ["npm:11.4.1", {
    "packageLocation": "./.yarn/cache/@emotion-react-npm-11.4.1-2f2428bc17-de3c215078.zip/node_modules/@emotion/react/",
    "packageDependencies": [
      ["@emotion/react", "npm:11.4.1"]
    ],
    "linkType": "SOFT",
  }],
  ["virtual:b2d269837bd4c17e9f413cc5e3bc227cd51fbcc3817ad404853a6df5a08187a58358e84bde8240c9c4b77c79e5244ef9dd61b78ec91958ec35facaf0f6945ad8#npm:11.4.1", {
    "packageLocation": "./.yarn/__virtual__/@emotion-react-virtual-4ad5061a2d/0/cache/@emotion-react-npm-11.4.1-2f2428bc17-de3c215078.zip/node_modules/@emotion/react/",
    "packageDependencies": [
      ["@emotion/react", "virtual:b2d269837bd4c17e9f413cc5e3bc227cd51fbcc3817ad404853a6df5a08187a58358e84bde8240c9c4b77c79e5244ef9dd61b78ec91958ec35facaf0f6945ad8#npm:11.4.1"],
      ...,
    ],
    ...,
    "linkType": "HARD",
  }],
  ["virtual:fd11ac8c1039b3bde8541fe7db827af13c0a7334d6193160e96414359b8e0318b4879e0856ffb9c3e7a149b628aad1ab2f123e46081ae0bb87b2a4e26a79241c#npm:11.4.1", {
    "packageLocation": "./.yarn/__virtual__/@emotion-react-virtual-fc4b14bdae/0/cache/@emotion-react-npm-11.4.1-2f2428bc17-de3c215078.zip/node_modules/@emotion/react/",
    "packageDependencies": [
      ["@emotion/react", "virtual:fd11ac8c1039b3bde8541fe7db827af13c0a7334d6193160e96414359b8e0318b4879e0856ffb9c3e7a149b628aad1ab2f123e46081ae0bb87b2a4e26a79241c#npm:11.4.1"],
      ...,
    ],
    ...,
    "linkType": "HARD",
  }]
]],
```

눈에 띄는 키워드는 **virtual**, `@emotion/react`의 virtual 두 개라는 점이다. 이를 보고 아까 보았던 `mulpitle instances`가 스쳐지나갔다.

virtual에 대해 잠깐 훑어보다보니 yarn v2부터 [가상 패키지](https://yarnpkg.com/advanced/lexicon#virtual-package)라는 것이 생겼다는 걸 알게 되었다. 문서를 읽고 생각을 정리해보니 `@emotion/react`의 가상패키지가 두개고 각각의 경로가 다른 것을 미루어보았을 때, `admin-project`, `@futureseller/design-system`의 `@emotion/react`이 각각 별도로 인스턴스화되고 있음을 짐작할 수 있었다. 따라서, multiple instance라는 에러가 발생하고 있던 것임을 유추할 수 있었다.

`admin-project`, `@futureseller/design-system` 두 개가 중복되는 패키지들간 호환되는 버전을 사용하고 있기 때문에 peerDependencies를 사용하면 하나의 가상 패키지로 만들 수 있을 것 같았다. 따라서, `@futureseller/design-system`를 아래와 같이 수정했다.

```json
{
  "name": "@futureseller/design-system",
  "peerDependencies": {
    "@chakra-ui/react": "^1.6.6",
    "@emotion/is-prop-valid": "^1.1.0",
    "@emotion/react": "^11",
    "@emotion/styled": "^11"
  }
}
```

수정 한 뒤 생성된 `pnp.js`의 일부는 아래와 같고, `multiple instnaces` 문제가 사라지면서 렌더링도 의도한대로 수행되었다.

```js
["@emotion/react", [
  ["npm:11.4.1", {
    "packageLocation": "./.yarn/cache/@emotion-react-npm-11.4.1-2f2428bc17-de3c215078.zip/node_modules/@emotion/react/",
    "packageDependencies": [
      ["@emotion/react", "npm:11.4.1"]
    ],
    "linkType": "SOFT",
  }],
  ["virtual:fd11ac8c1039b3bde8541fe7db827af13c0a7334d6193160e96414359b8e0318b4879e0856ffb9c3e7a149b628aad1ab2f123e46081ae0bb87b2a4e26a79241c#npm:11.4.1", {
    "packageLocation": "./.yarn/__virtual__/@emotion-react-virtual-fc4b14bdae/0/cache/@emotion-react-npm-11.4.1-2f2428bc17-de3c215078.zip/node_modules/@emotion/react/",
    "packageDependencies": [
      ["@emotion/react", "virtual:fd11ac8c1039b3bde8541fe7db827af13c0a7334d6193160e96414359b8e0318b4879e0856ffb9c3e7a149b628aad1ab2f123e46081ae0bb87b2a4e26a79241c#npm:11.4.1"],
      ...,
    ],
    ...,
    "linkType": "HARD",
  }]
]],
```

---

## 마무리

패키지를 CI/CD 과정에서 의존성을 설치할 필요가 없어지기 때문에 소요되는 시간이 줄어들 것이라 예상했다. Github Action에서 PR 단위로 빌드가 통과하는지 체크하고 있었는데, 기존에는 5~6분 가량 걸리던 것이 3분~4분 가량으로 절감되었다. 실제 애플리케이션의 CI/CD는 Amplify로 구성되어 있는데 이 부분에서는 기존의 결과와 큰 차이가 없었다.
이는 Amplify cache 설정에 의해 `node_modules`를 캐싱할 수 있었기 때문에 zero-install로 전환했을 때 큰 이득을 얻진 못했다.

부가적으로 `node_modules` 디렉토리의 크기는 약 788M에 달했는데 Yarn PnP의 의존성은 170M 정도에 불과해서 스토리지 용량을 아낄 수 있었다.

이 과정을 진행하면서 든 생각을 몇 가지 요약하자면,

1. 문서를 잘 읽자. 삽질하고 난뒤 문서를 보니 문서에 다 써있다.
2. 가능하면 고생하지 말고 yarn berry가 호환되는 패키지를 찾자. 찾아보고 없다면 정말 필요한 패키지인지 따져보고 고쳐쓰거나 새로 작성해야한다.
3. package.json의 명세를 다시 읽어보자. peerDependency에 대해 두루뭉실하게 알고 있었는데 이 계기를 통해 어떻게 동작하는지 알게 되었다.
4. 조언을 얻을 수 있고 함께 고민할 수 있는 동료는 소중하다.
