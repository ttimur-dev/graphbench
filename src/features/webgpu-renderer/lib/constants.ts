export const BYTES_PER_FLOAT = 4;
export const EDGE_FLOATS_PER_VERTEX = 5;
export const EDGE_STRIDE_BYTES = EDGE_FLOATS_PER_VERTEX * BYTES_PER_FLOAT;
export const NODE_FLOATS_PER_VERTEX = 8;
export const NODE_STRIDE_BYTES = NODE_FLOATS_PER_VERTEX * BYTES_PER_FLOAT;

export const EDGE_SEGMENTS = 28;
export const EDGE_WIDTH = 2.4;
export const EDGE_GLOW = 6.5;
export const NODE_RADIUS = 12;
export const NODE_BORDER_WIDTH = 1;
export const NODE_SHADOW_PAD = 18;

export const GPU_BUFFER_USAGE_COPY_DST = 0x0008;
export const GPU_BUFFER_USAGE_VERTEX = 0x0020;
export const GPU_BUFFER_USAGE_UNIFORM = 0x0040;
export const GPU_SHADER_STAGE_VERTEX = 0x1;
export const GPU_COLOR_WRITE_ALL = 0xf;
