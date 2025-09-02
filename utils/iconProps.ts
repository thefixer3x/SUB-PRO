// Utility to handle Lucide React Native icon props
// The newer version uses 'stroke' instead of 'color'

export interface IconProps {
  size?: number;
  color?: string;
  stroke?: string;
}

export const createIconProps = (size: number = 20, color: string = '#000000'): IconProps => ({
  size,
  stroke: color, // Use stroke instead of color for newer Lucide versions
});

export const getIconProps = (props: { size?: number; color?: string }): IconProps => ({
  size: props.size || 20,
  stroke: props.color || '#000000',
});