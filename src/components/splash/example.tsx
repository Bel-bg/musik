import InfiniteSpiral from '../InfiniteSpiral';

const images = [
  { src: '/images/landscape-1.jpg', alt: 'Mountain lake' },
  { src: '/images/landscape-2.jpg', alt: 'Forest path' },
  { src: '/images/landscape-3.jpg', alt: 'Rocky summit' },
  { src: '/images/landscape-4.jpg', alt: 'Ocean shore' },
  { src: '/images/landscape-5.jpg', alt: 'Green meadow' },
  { src: '/images/landscape-6.jpg', alt: 'Desert light' }
];

<div style={{ height: '600px', position: 'relative', overflow: 'hidden' }}>
  <InfiniteSpiral
    items={images}
    animationMode="auto"
    speed={0.55}
    radius={170}
    cardWidth={100}
    cardHeight={100}
    verticalSpacing={60}
    perspective={1000}
    cardRadius={10}
    centerScale={1.2}
    edgeBlur={6}
    cardsPerTurn={7}
    pauseOnHover
    direction="up"
    rotation={0}
    cardTilt={0}
    edgeFade={0.3}
    imageFit="cover"
    grayscale={1}
/>
</div>




import FoldText from '../FoldText';

<FoldText
  text="Design unfolds"
  splitBy="char"
  hinge="top"
  trigger="mount"
  duration={0.65}
  stagger={0.045}
  ease="power3.out"
  perspective={700}
  creaseShading={0.55}
  fontSize={80}
  fontWeight={800}
  color="#f7f2e8"
/>