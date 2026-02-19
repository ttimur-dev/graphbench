import type { DynamicVertexBuffer, Runtime } from "./types";

export const drawPass = ({
  edgeBuffer,
  nodeBuffer,
  runtime,
}: {
  edgeBuffer: DynamicVertexBuffer;
  nodeBuffer: DynamicVertexBuffer;
  runtime: Runtime;
}) => {
  const encoder = runtime.device.createCommandEncoder();
  const pass = encoder.beginRenderPass({
    colorAttachments: [
      {
        view: runtime.context.getCurrentTexture().createView(),
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  });

  pass.setBindGroup(0, runtime.bindGroup);

  if (edgeBuffer.vertexCount > 0 && edgeBuffer.buffer) {
    pass.setPipeline(runtime.edgePipeline);
    pass.setVertexBuffer(0, edgeBuffer.buffer);
    pass.draw(edgeBuffer.vertexCount);
  }

  if (nodeBuffer.vertexCount > 0 && nodeBuffer.buffer) {
    pass.setPipeline(runtime.nodePipeline);
    pass.setVertexBuffer(0, nodeBuffer.buffer);
    pass.draw(nodeBuffer.vertexCount);
  }

  pass.end();
  runtime.device.queue.submit([encoder.finish()]);
};
