export const DESIGN_WIDTH = 430;
export const DESIGN_HEIGHT = 932;

export type Orientation = "portrait" | "landscape";

export type Viewport = {
  width: number;
  height: number;
  orientation: Orientation;
  scale: number;
  offsetX: number;
  offsetY: number;
};

export const computeViewport = (
  windowWidth: number,
  windowHeight: number,
  designWidth = DESIGN_WIDTH,
  designHeight = DESIGN_HEIGHT,
): Viewport => {
  const orientation: Orientation =
    windowWidth >= windowHeight ? "landscape" : "portrait";
  const scale = Math.min(
    windowWidth / designWidth,
    windowHeight / designHeight,
  );
  return {
    width: windowWidth,
    height: windowHeight,
    orientation,
    scale,
    offsetX: (windowWidth - designWidth * scale) / 2,
    offsetY: (windowHeight - designHeight * scale) / 2,
  };
};
