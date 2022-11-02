---
title: 'mswjs/msw 뜯어보기'
date: '2022-11-03T00:00:00.121Z'
layout: post
draft: false
category: 'JavaScript'
description: 'mswjs는 어떻게 동작하는걸까?'
---

본문에서는 MSW가 브라우저에서 어떻게 동작하는지 살펴보려합니다. 대략적인 소개는 [공식문서](https://mswjs.io/docs)를 읽어보시면 됩니다. mocking하는 방법은 [MSW로 백앤드 API 모킹하기
](https://www.daleseo.com/mock-service-worker/), [MSW로 API 모킹하기
](https://blog.mathpresso.com/msw%EB%A1%9C-api-%EB%AA%A8%ED%82%B9%ED%95%98%EA%B8%B0-2d8a803c3d5c)를 참고하시면 될 것 같습니다. 혹은 [예시](https://github.com/FutureSeller/my-react-snippet/tree/main/examples/recoil/src)를 참고하셔도 됩니다.

---

## 들어가기에 앞서..

MSW(Mock Service Worker)에서 가장 중요한 키워드는 라이브러리 이름에도 들어가있듯 서비스 워커입니다. 이 글에서는 서비스 워커가 무엇인지에 대해 자세히 다루진 않기 때문에 자세한 내용은 [Service Worker API](https://developer.mozilla.org/ko/docs/Web/API/Service_Worker_API)를 읽어보시면 됩니다. 저는 MSW에서 서비스 워커는 "웹 응용 프로그램의 네트워크 요청을 가로채 중간에서 특정한 작업을 수행하는 자바스크립트"로 정의하겠습니다.

---

## Overview

![msw-overview](/img/msw-overview.jpeg)

사실은 overview만 보고도 MSW가 어떻게 동작하는지 알 수 있습니다. (MSW를 사용하는데 overview 이상의 지식이 필요할까 싶기도 합니다.)

요약하자면 MSW는 웹 응용 프로그램의 요청을 서비스 워커가 가로챈 뒤, MSW가 mocking하고 있는 경로에 대한 응답을 웹 응용 프로그램에게 되돌려줍니다.

이 overview를 서비스 워커, MSW가 각각 어떤 라이프사이클을 가지고 메세지를 어떻게 주고 받는지가 궁금해져서 내부를 살펴보게 되었습니다.

---

## 간단한 Example

웹 응용 프로그램은 서비스 워커를 등록하고, 네트워크 요청을 가로챈 서비스 워커가 보내는 메세지를 기다립니다. 이에 해당하는 코드는 아래와 같습니다.

```typescript
// src/mocks/worker.ts
import { setupWorker, rest } from 'msw'

type GET_RESPONSE_TYPE = Parameters<typeof rest.get>[1]

const getUsers: GET_RESPONSE_TYPE = (_, res, ctx) => {
  return res(
    ctx.status(200),
    ctx.json({
      users: ['future', 'seller'],
    })
  )
}

const handlers = [rest.get('/api/users', getUsers)]
export const worker = setupWorker(...handlers)
```

```tsx
// src/index.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App'
import { worker } from './mocks/worker'

if (process.env.NODE_ENV === 'development') {
  worker.start()
}

const rootElement = document.getElementById('root')
const root = createRoot(rootElement)

root.render(
  <StrictMode>
    <App />
  </StrictMode>
)
```

---

## Finite State Machine로 바라보기: MSW

<iframe src="https://stately.ai/viz/embed/9f916290-5be2-4eeb-9d32-b9d42abb9011?mode=viz&panel=code&showOriginalLink=1&readOnly=1&pan=1&zoom=1&controls=1" sandbox="allow-same-origin allow-scripts" width="100%" height="300px"></iframe>

개인적으로 정리해본 MSW의 State Machine입니다. (MSW의 내부 라이프 사이클과는 다르고, 라이브러리 사용자의 관점에서 바라보았습니다.)

아래부터는 클라이언트의 각각 상태들이 전이하며 수행되는 일들을 하나씩 짚어보겠습니다.

### Transition 1. `setupWorker(...handlers)`

`setupWorker`는 MSW가 서비스 워커를 생성할 때 필요한 사전 작업들을 수행합니다.
`context`는 mocking 성공 여부, 사용될 핸들러들, 서비스 워커 객체, 메세지를 주고 받기 위한 이벤트 리스너를 만들수 있는 함수 등을 만들어 담아둔 객체입니다.

예를 들면 아래 `workerChannel`의 `on`은 서비스 워커에게 받은 `message`를 다루기 위함이고, `send`는 서비스 워커에게 `postMessage`를 통해 메세지를 전달합니다.

```typescript
function setupWorker(...requestHandlers: RequestHandler[]) {
  const context = {
    isMockingEnabled: false,
    worker: null,
    requestHandlers: [...requestHandlers],
    workerChannel: {
      on(eventType, callback) {
        context.events.addListener(navigator.serviceWorker, 'message', (event: MessageEvent) => {
          if (event.source !== context.worker) {
            return
          }

          const message = event.data as ServiceWorkerMessage<typeof eventType, any>

          if (!message) {
            return
          }

          if (message.type === eventType) {
            callback(event, message)
          }
        })
      },
      send(type) {
        context.worker?.postMessage(type)
      },
    },
  }

  const startHandler = createStartHandler(context)

  return {
    start: prepareStartHandler(startHandler, context),
  }
}
```

`context`객체는 각종 함수의 인자로 전달되고, 외부 함수들이 `context` 객체의 프로퍼티에 직접 접근해서 값들을 가져오며 갱신하게 됩니다.

`setupWorker()`에서는 MSW가 가지는 내부 라이프 사이클을 외부에 노출시키지 않고, 필요에 따라 이벤트 핸들러를 통해 트래킹 할 수 있도록 pipe 시켜둡니다. 주로 디버깅을 위해서 쓰거나 third-party에서 확장하기 위해 사용됩니다. [life-cycle-events](https://mswjs.io/docs/extensions/life-cycle-events)를 참고하면 자세한 내용을 알 수 있습니다.

```typescript
function setupWorker(...requestHandlers: RequestHandler[]) {
  const emitter = new StrictEventEmitter<WorkerLifecycleEventsMap>()
  const publicEmitter = new StrictEventEmitter<WorkerLifecycleEventsMap>()
  pipeEvents(emitter, publicEmitter) // 여기서 pipe 시켜줍니다.

  const context = {...}

  return {
    start: ...,
    events: {
      on(...args) {
        return publicEmitter.on(...args)
      },
      removeListener(...args) {
        return publicEmitter.removeListener(...args)
      },
      removeAllListeners(...args) {
        return publicEmitter.removeAllListeners(...args)
      },
    },
  }
}

// 필요하다면 아래처럼 사용할 수 있습니다.
const listener = () => console.log('new request')
worker.events.on('request:start', listener)
```

### Transition 2. `worker.start()`

`worker.start()`는 서비스 워커로 부터 `REQUEST`와 `RESPONSE` 메세지를 받는 이벤트 리스너를 등록하고 서비스 워커를 생성합니다.

#### REQUEST, RESPONSE 이벤트 리스너

1. `REQUEST` 이벤트 리스너는 `setupWorker`에서 등록한 핸들러의 경로와 매칭되는 경로의 응답 값을 `MOCK_RESPONSE` 메세지에 담아 서비스 워커에게 돌려줍니다. overview에서 봤던, 3번(match against mocks), 4번(mocked reponse)이 과정에서 이루어집니다.
2. `RESPONSE` 이벤트 리스너는 MSW가 내부적으로 관리하는 라이프 사이클의 상태 전이를 위해 사용됩니다.

#### 서비스 워커 생성

서비스 워커 생성과 관련되어 수행되는 작업의 순서는 아래와 같습니다.

1. 자바스크립트 경로와 시작 옵션들을 가지고 `serviceWorker.register` 함수를 호출합니다. 이 과정에서 `context`객체의 서비스 워커 관련 프로퍼티들이 갱신됩니다.

2. 등록된 서비스 워커가 outdated 되었는지 검증하는 `INTEGRITY_CHECK`를 수행합니다. MSW는 서비스 워커 자바스크립트 파일을 CLI를 통해 생성하는데, `node_modules`에 있는 서비스 워커 자바스크립트 파일을 브라우저에서 등록할 수 없기 때문입니다. 이때, 서비스 워커와 관련이 있는 라이브러리의 코드가 변경되었을때 오동작을 막기 위해 `INTEGRITY_CHECKSUM` md5 문자열을 비교하여 outdated 되었는지 검증합니다. ([참고](https://mswjs.io/docs/api/setup-worker/start#integrity-check))

3. 서비스 워커가 살아있는지 확인하기 위해 `KEEP_ALIVE` 메세지를 5초 간격으로 보냅니다.

4. 서비스 워커가 활성화되었을 때 mocking이 완료되었다고 `MOCK_ACTIVATE` 메세지를 보내고 서비스 워커로 부터 `MOCK_ENABLED` 응답을 받으면, mocking이 완료되었다는 것을 보장합니다. 이때 `context.isMockingEnabled`를 true로 만듭니다.

### Transition 3. `success`

여기서부터는 `worker.start()`에서 등록해두었던, REQUEST / RESPONSE 메세지를 주고 받을 수 있게 됩니다.

---

## Finite State Machine로 바라보기: 서비스 워커의 시점

<iframe src="https://stately.ai/viz/embed/d6b5dc5f-630d-447f-9f58-d1ccca811b11?mode=viz&panel=code&readOnly=1&showOriginalLink=1&controls=1&pan=1&zoom=1" sandbox="allow-same-origin allow-scripts" width="100%" height="500px"></iframe>

`ACTIVATE` 상태로 전이되기 전까지 과정은 서비스 워커를 등록하기 위한 과정이므로 생략합니다.

서비스 워커는 `message`, `fetch` 두 개의 이벤트 리스너를 등록합니다. 간단히 요약하자면 `message`는 MSW가 전달하는 메세지들을 해석하고 응답을 보내주고, `fetch`는 웹 응용 프로그램의 네트워크 요청을 가로채는데 쓰입니다.

`message`는 INTEGRITY_CHECK, KEEP_ALIVE, MOCK_ACTIVATE, 등과 같이 유효성 검사나 서비스 워커와 웹 응용 프로그램간 현재 상태를 sync하는데 쓰입니다. 또한 웹 응용 프로그램이 `beforeunload`일 때, MSW가 보내준 `CLIENT_CLOSED` 메세지를 받고 서비스 워커를 비활성화 합니다.

`fetch`는 웹 응용 프로그램의 fetch를 가로채고 MSW와 메세지를 주고 받으며, mocking된 응답을 웹 응용프로그램에 전달하는 중간자 역할을 합니다.

1. `[서비스 워커]`: 웹 응용 프로그램에게 가로챈 응답이 무엇인지 `REQUEST` 메세지에 담아 MSW 에게 전달한다.
2. `[MSW]`: 경로를 매칭하고 등록된 핸들러의 응답을 `MOCK_RESPONSE` 메세지에 담아 서비스 워커에게 전달한다.
3. `[서비스 워커]`: `RESPONSE` 메세지에 응답을 담아 MSW에게 전달한다.
4. `[서비스 워커]`: `event.respondWith`을 통해 응답을 웹 응용 프로그램에게 전달한다.
5. `[웹 응용 프로그램]`: mocking된 응답을 네트워크 요청에 의해 받는 것처럼 느낀다.

---

## 웹 응용프로그램의 시점

웹 응용 프로그램 입장에서는 가운데 중간자인 서비스 워커가 요청을 가로챈 뒤, `respondWith`에 담아준 값을 응답으로 주기 때문에 실제 오리진에서 온 것 처럼 느낍니다.

---

## Recap: 한줄 요약

MSW는 서비스 워커와 메세징을 통해 이벤트 기반으로 가로챈 요청에 대해 mocking된 응답을 줍니다.

---

## 다루지 않은 것들

- 서비스 워커가 install, activate 되는 과정
- MSW의 내부 라이프 사이클 및 에러 핸들링
- MSW와 서비스 워커가 메세지를 교환하기 위해 MessageChannel을 사용한 것

---

## 참고한 글들

- https://mswjs.io/docs
- https://www.daleseo.com/mock-service-worker
- https://blog.mathpresso.com/msw%EB%A1%9C-api-%EB%AA%A8%ED%82%B9%ED%95%98%EA%B8%B0-2d8a803c3d5c
- https://wormwlrm.github.io/2020/11/29/Communicate-with-iframe-via-Message-Channel-API.html
