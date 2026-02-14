import type { NodeDragStartHandler, NodeType } from "../types/node";
import styles from "./Node.module.css";

type Props = NodeType & {
  onDragStart: NodeDragStartHandler;
};

export const Node = ({ id, position, width, height, onDragStart }: Props) => {
  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    event.preventDefault();

    const rect = event.currentTarget.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;

    onDragStart([offsetY, offsetX], id);
  };

  return (
    <div
      id={id}
      data-role="node"
      className={styles.node}
      style={{
        position: "absolute",
        top: position.y,
        left: position.x,
        width,
        height,
      }}
      onMouseDown={handleMouseDown}
    >
      <span className={styles.label}>node-{id}</span>
    </div>
  );
};
