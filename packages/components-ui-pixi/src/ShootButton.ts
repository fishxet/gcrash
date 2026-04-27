export type ShootButtonProps = {
  enabled: boolean;
  onPress: () => void;
};

export const createShootButton = (_props: ShootButtonProps): unknown => {
  throw new Error("ShootButton not implemented");
};
