import mandalaCorner from '../assets/mandala-corner.svg';

type Position = 'bottom-left' | 'bottom-right' | 'bottom-center';

const POSITION_CLASSES: Record<Position, string> = {
  'bottom-left': 'left-0 -translate-x-1/4 translate-y-1/4',
  'bottom-right': 'right-0 translate-x-1/4 translate-y-1/4',
  'bottom-center': 'left-1/2 -translate-x-1/2 translate-y-1/4',
};

/** Faint thin-outline mandala watermark bleeding off the bottom of a page - the parent needs
 * `relative overflow-hidden` for this to clip correctly instead of spilling into other pages. */
export default function MandalaAccent({ position = 'bottom-left' }: { position?: Position }) {
  return (
    <img
      src={mandalaCorner}
      alt=""
      aria-hidden="true"
      className={`pointer-events-none absolute bottom-0 w-[36rem] sm:w-[56rem] opacity-[0.12] ${POSITION_CLASSES[position]}`}
    />
  );
}
