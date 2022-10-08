---
title: '@chakra-ui/accordion 뜯어보기'
date: '2022-10-08T00:00:00.121Z'
layout: post
draft: false
category: 'Design System Component'
description: '@chakra-ui/accordion은 어떻게 어떻게 동작하는걸까?'
---

## Table of contents

<ol>
  <li><a href="#intro">Intro</a></li>
  <li><a href="#question1">Question1: @chakra-ui/accordion은 하위 노드들을 어떻게 식별하는 것일까?</a></li> 
  <li><a href="#question2">Question2: @chakra-ui/accordion은 하위 노드들의 순서는 어떻게 관리되는걸까?</a></li>
  <li><a href="#wrap-up">Wrap up</a></li>
</ol>

---

## Intro

아래 코드는 chakra-ui를 사용하여 아코디언을 만든 예시입니다.

```tsx
<Accordion>
  <AccordionItem>
    <AccordionButton>
      <Box flex="1" textAlign="left">
        Section 1 title
      </Box>
      <AccordionIcon />
    </AccordionButton>
    <AccordionPanel pb={4}>Lorem ipsum</AccordionPanel>
  </AccordionItem>
  <AccordionItem>
    <AccordionButton>
      <Box flex="1" textAlign="left">
        Section 2 title
      </Box>
      <AccordionIcon />
    </AccordionButton>
    <AccordionPanel pb={4}>Ut enim ad</AccordionPanel>
  </AccordionItem>
</Accordion>
```

예시를 보면서 궁금했던 점은 chakra-ui가 어떻게 하위 노드들(`AccordionItem`)을 식별하고 순서를 부여할 수 있을까였습니다.
식별자는 하위 노드들을 open, close하는데 사용될테고, 키보드 액션(up, down 등)을 지원하려면 각 노드들의 순서를 알아야하는데 특정 조건에 의해 렌더링 여부가 결정될 수도 있습니다. 이 모든 것들이 내부에 숨겨져있기 때문에 어떻게 동작하는지 궁금해졌습니다.

---

<h2 id="question1">Question1: @chakra-ui/accordion은 하위 노드들을 어떻게 식별하는 것일까?</h2>

### 하위 노드들을 관리하기 위한 `DescendantManager`

아코디언 하위에 어떤 하위 노드들이 존재하는지 식별하기 위해서는 해당 노드를 식별할 수 있는 식별자나 레퍼런스를 어딘가 저장해두어야합니다.
이 작업은 [@chakra-ui/descendant](https://github.com/chakra-ui/chakra-ui/tree/main/packages/components/descendant)의 `DescendantManager`가 수행합니다. `DescendantManager`를 노드를 등록 / 해제만 하도록 단순화 시키면 아래와 같습니다.

```typescript
// 노드의 순서를 저장할 수 있도록 확장한 객체: Question2 에서 다룸.
type Descendant<T> = {
  node: T
  index: number
}

class DescendantManager<T extends HTMLElement> {
  private descendants = new Map<T, Descendant<T>>()

  register = (node: T | null) => {
    if (!node || this.descendants.has(node)) {
      return
    }

    this.descendants.set(node, { node, index: -1 })
  }

  unregister = (node: T) => {
    this.descendants.delete(node)
  }
}
```

Map의 key는 노드이고 value는 노드에 index 프로퍼티를 덧댄 객체입니다. key로는 현재 노드가 문서에 존재하는지 식별하고, value에는 액션이나 effect가 발생했을때 변경되어야 할 값들을 담아놓습니다.

AccordionItem 컴포넌트가 mount 될 때 register를 호출하도록 하고, unmount 될 때 unregister를 호출하도록 하면 어떤 AccordionItem들이 등록되었는지 식별할 수 있습니다.

### mount 하는 예시

chakra-ui에서 제공하는 `useDescendant`라는 훅을 사용하면 되긴하지만, 이해를 돕기 위해 훅의 로직을 단순화시키고 AccordionItem으로 꺼낸 예시는 아래와 같습니다.

```tsx
function AccordionItem({ children }: { children: React.React.Node }) {
  const descendants = useDescendantsContext()
  const [index, setIndex] = useState(-1)
  const ref = useRef(null)

  // unmount 될 때 unregister 시킴
  useEffect(() => {
    return () => {
      if (!ref.current) {
        return
      }

      descendants.unregister(ref.current)
    }
  }, [])

  // dataIndex가 외부 요인으로 변할 수도 있기 때문에 계속 tracking 해야함
  useEffect(() => {
    if (!ref.current) {
      return
    }

    const dataIndex = Number(ref.current.dataset['index'])
    if (index != dataIndex && !Number.isNaN(dataIndex)) {
      setIndex(dataIndex)
    }
  })

  return (
    <div
      // 콜백 ref를 사용해서 register 함수에 node를 넘김
      ref={e => {
        descendants.register(e)
        ref.current = e
      }}
    >
      {children}
    </div>
  )
}
```

---

<h2 id="question2">Question2: @chakra-ui/accordion은 하위 노드들의 순서는 어떻게 관리되는 걸까?</h2>

자바스크립트의 Map은 set한 순서를 유지하지만 AccordionItem은 특정 조건에 의해 렌더링 유무를 결정하게 될 수도 있습니다. 예를들면 아래 예시처럼 `show`라는 값에 의해 두 번째 AccordionItem 컴포넌트의 렌더링 여부가 결정된다고 가정해봅시다. AccordionItem들의 순서를 몰라도 렌더링하는데는 크게 문제 없지만, 키보드 액션을 지원하려면 순서가 중요해집니다. 따라서, 아코디언이 리렌더링되었을때 하위 노드들의 순서를 도출해낼수 있어야합니다.

```tsx
<Accordion>
  <AccordionItem>One</AccordionItem>
  {show && <AccordionItem>Two</AccordionItem>}
  <AccordionItem>Three</AccordionItem>
  <AccordionItem>Four</AccordionItem>
</Accordion>
```

### 하위 노드들 간 순서를 결정하는 방법: compareDocumentPosition

Web API에 [`node.compareDocumentPosition(other)`](https://developer.mozilla.org/en-US/docs/Web/API/Node/compareDocumentPosition)함수는 현재 노드(node)와 인자로 받은 노드(other)의 상대적인 위치를 계산해 bitmask하여 반환합니다.

- 0: 같은 노드일 때
- Node.DOCUMENT_POSITION_DISCONNECTED(0x1): 두 다른 root(document)를 가질 때
- Node.DOCUMENT_POSITION_PRECEDING(0x10): other가 node의 앞에 존재할 때
- Node.DOCUMENT_POSITION_FOLLOWING(0x100): other가 node 보다 뒤에 존재할 때
- Node.DOCUMENT_POSITION_CONTAINS(0x1000): other가 node의 조상일 때
- Node.DOCUMENT_POSITION_CONTAINED_BY(0x10000): others가 node의 자손일 때
- Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC(0x100000): 브라우저 동작에 의존한 결과값

```javascript
const head = document.head
const body = document.body
const compare = head.compareDocumentPosition(body)

// 0x100. head가 body 보다 뒤에 존재할 때
if (compare & Node.DOCUMENT_POSITION_FOLLOWING) {
  console.log('Well-formed document')
} else {
  console.error('<head> is not before <body>')
}
```

위의 예시는 head보다 body가 먼저 정의되어있어야만 `Well-formed document`를 콘솔에 찍어줍니다. 이와 같이 `compareDocumentPosition` 함수를 사용하면 노드들의 배치관계에 따라 순서를 도출해낼 수 있고 이를 통해 노드들을 정렬할 수 있습니다.
chakra-ui가 목록들의 순서를 정렬하는 함수는 아래와 같습니다.

```typescript
export function sortNodes(nodes: Node[]) {
  return nodes.sort((a, b) => {
    const compare = a.compareDocumentPosition(b)

    // nodeB가 nodeA보다 뒤에 있거나, 자손일때
    if (
      compare & Node.DOCUMENT_POSITION_FOLLOWING ||
      compare & Node.DOCUMENT_POSITION_CONTAINED_BY
    ) {
      // a < b, a를 앞으로 이동
      return -1
    }

    // nodeB가 nodeA보다 앞에 있거나, 조상일때
    if (
      compare & Node.DOCUMENT_POSITION_PRECEDING || //;
      compare & Node.DOCUMENT_POSITION_CONTAINS
    ) {
      // a > b, a를 뒤로 이동
      return 1
    }

    // 노드 간 다른 root를 가지거나, 특정 동작이 정의되어있을때
    if (
      compare & Node.DOCUMENT_POSITION_DISCONNECTED ||
      compare & Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC
    ) {
      throw Error('Cannot sort the given nodes.')
    } else {
      // 같은 노드일 때, 순서 유지
      return 0
    }
  })
}
```

### 노드들의 순서를 정렬하기 위해 `DescendantManager` 확장

노드가 존재하는지 식별하기위한 `DescendantManager`를 노드들의 순서까지 관리해주도록 확장해야합니다.

```typescript
// node의 순서를 저장할 수 있도록 확장한 객체
type Descendant<T> = {
  node: T
  index: number
}

class DescendantManager<T extends HTMLElement> {
  private descendants = new Map<T, Descendant<T>>()

  register = (node: T | null) => {
    if (!node || this.descendants.has(node)) {
      return
    }

    // Note 1
    const nodes = Array.from(this.descendants.keys()).concat(node)
    const sortedNodesByPosition = sortNodes(nodes)

    this.descendants.set(node, { node, index: -1 })

    // Note 2
    this.descendants.forEach(descendant => {
      const index = sortedNodesByPosition.indexOf(descendant.node)
      descendant.index = index
      descendant.node.dataset['index'] = index.toString()
    })
  }

  unregister = (node: T) => {
    this.descendants.delete(node)

    // Note 3
    const sortedNodesByPosition = sortNodes(Array.from(this.descendants.keys()))
    this.descendants.forEach(descendant => {
      const index = sortedNodesByPosition.indexOf(descendant.node)
      descendant.index = index
      descendant.node.dataset['index'] = index.toString()
    })
  }
}
```

- Note 1: [register]: 기존에 등록되었던 노드들과 현재 등록할 노드를 정렬한다.
- Note 2: [register] 노드들을 정렬하고 순서를 index 프로퍼티와 data-attribute에 넣어둡니다. (data-attribute는 나중에 컴포넌트가 관리하는 상태와 synchronize 하는데 사용됩니다.)
- Note 3: [unregister]: unmount 되었을 때 관심밖인 현재 노드를 메모리에서 제거하고, 제거된 노드로 인해 순서가 변경될 수 있으므로 노드들의 순서를 재정렬합니다.

chakra-ui는 아래처럼 DescendantManager를 사용해서 아코디언 하위 노드를 관리하기 위해 context와 hook 또한 제공합니다.(단순화 시킨 버전)

```tsx
export function useDescendants<T extends HTMLElement>() {
  const descendants = useRef(new DescendantManager<T>())
  return descendants.current
}

export const DescendantsContext = createContext<ReturnType<typeof useDescendants>>()
export const DescendantsContextProvider = DescendantsContext.Provider
export const useDescendantsContext = () => useContext(DescendantsContext)

function Accordion() {
  const descendants = useDescendants()

  return <DescendantsProvider value={descendants}>{children}</DescendantsProvider>
}
```

<details>
  <summary class="mb-4">(아코디언은 아니지만) 들쭉날쭉한 JSX 구조에서 descendant가 동작하는 예시</summary>
  <iframe 
    src="https://stackblitz.com/edit/react-ts-77jggt?ctl=1&embed=1&file=App.tsx"
    width="100%"
    height="600px"
  ></iframe>
</details>

---

## Wrap up

- 아코디언의 하위 목록들을 식별하기 위해 자손들을 등록 / 삭제를 관장하는 Map을 선언합니다.
- 이 Map의 연산들을 추상화한 DescendantManager가 있고 DescendantManager Context를 선업합니다.
- 키보드 액션을 지원하기 위해 목록들의 순서가 중요하고, AccordionItem이 mount되었을 때 트리구조에서 특정 두 노드들의 위치상 관계를 나타내주는 `compareDocumentPosition`을 사용해서 요소들의 순서를 정한 뒤 Map에 추가합니다.
- AccordionItem이 unmount되었을 때 Map에서 제거합니다.

---

## 번외: radix-ui는 어떻게 했을까?

radix-ui 또한 chakra-ui와 마찬가지로 Descendant(radix-ui의 [Collection](https://github.com/radix-ui/primitives/tree/1f66c88538da13f5ec6b4e97f215268df1a3baa2/packages/react/collection))를 관리하는 Context가 있고 여기서도 Map으로 노드들을 관리합니다.

다만 하위 노드들을 식별하고 재정렬하는 방법은 chakra-ui보다 간단합니다. Collection의 하위 노드인 [`CollectionItemSlot`](https://github.com/radix-ui/primitives/blob/1f66c88538da13f5ec6b4e97f215268df1a3baa2/packages/react/collection/src/Collection.tsx#L79-L97)컴포넌트에 `data-radix-collection-item`이라는 data-attribute를 심어두고 mount될 때 Map에 넣습니다. 노드들의 식별은 key 값인 노드의 레퍼런스로 이루어집니다.

키보드 액션을 지원하기 위해 순서를 정해야하는데, 이때 data-attribute가 심어진 노드들을 가져온 뒤 (`querySelectorAll("[data-radix-collection-item]")`), 현재 이벤트를 트리거 한 노드가 속한 위치를 계산하여 index를 가져옵니다.

(개인적으로는 radix-ui의 접근 방법이 더 쉽고 직관적인 것 같습니다.)
