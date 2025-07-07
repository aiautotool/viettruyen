import React, { useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { Button } from './ui/button';

// Định nghĩa kiểu dữ liệu cho mục có thể kéo thả
interface DraggableSceneItemProps {
  index: number;
  id: any;
  scene: string;
  onDelete: (index: number) => void;
  onEdit: (e: React.ChangeEvent<HTMLTextAreaElement>, index: number) => void;
  moveScene: (dragIndex: number, hoverIndex: number) => void;
  isFirst?: boolean;
  isLast?: boolean;
}

const ItemType = 'SCENE';

const DraggableSceneItem: React.FC<DraggableSceneItemProps> = ({ 
  index, 
  id, 
  scene, 
  onDelete, 
  onEdit, 
  moveScene,
  isFirst = false,
  isLast = false
}) => {
  const ref = useRef<HTMLDivElement>(null);

  // Hook useDrop để xử lý khi một item khác được thả vào item này
  const [, drop] = useDrop({
    accept: ItemType,
    hover(item: any, monitor) {
      if (!ref.current) {
        return;
      }
      const dragIndex = item.index;
      const hoverIndex = index;

      // Không thay thế các items với chính nó
      if (dragIndex === hoverIndex) {
        return;
      }

      // Tính toán vị trí trong màn hình
      const hoverBoundingRect = ref.current?.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      const hoverClientY = clientOffset!.y - hoverBoundingRect.top;

      // Chỉ thực hiện di chuyển khi con trỏ chuột qua 1/2 chiều cao của item
      // Khi kéo xuống, chỉ thực hiện khi con trỏ ở dưới 50%
      // Khi kéo lên, chỉ thực hiện khi con trỏ ở trên 50%
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return;
      }
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return;
      }

      // Thực hiện di chuyển
      moveScene(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  // Hook useDrag để xử lý khi item này được kéo
  const [{ isDragging }, drag] = useDrag({
    type: ItemType,
    item: () => ({ id, index }),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  // Áp dụng cả drag và drop cho ref
  drag(drop(ref));

  // Xử lý di chuyển lên
  const handleMoveUp = () => {
    if (index > 0) {
      moveScene(index, index - 1);
    }
  };

  // Xử lý di chuyển xuống
  const handleMoveDown = () => {
    moveScene(index, index + 1);
  };

  return (
    <div 
      ref={ref} 
      className={`flex items-start gap-2 mb-2 p-2 rounded-lg transition-all ${
        isDragging ? 'opacity-50 bg-gray-600' : 'bg-gray-800'
      }`}
    >
      <div className="flex flex-col items-center mr-2 text-gray-400">
        <div className="cursor-move mb-1" title="Kéo để thay đổi vị trí">
          <i className="fas fa-grip-vertical"></i>
        </div>
        <div className="flex flex-col">
          <button 
            className={`text-blue-400 hover:text-blue-300 py-1 ${isFirst ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
            onClick={handleMoveUp}
            disabled={isFirst}
            title="Di chuyển lên"
          >
            <i className="fas fa-chevron-up text-xs"></i>
          </button>
          <button 
            className={`text-blue-400 hover:text-blue-300 py-1 ${isLast ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
            onClick={handleMoveDown}
            disabled={isLast}
            title="Di chuyển xuống"
          >
            <i className="fas fa-chevron-down text-xs"></i>
          </button>
        </div>
      </div>
      <textarea
        value={scene}
        onChange={(e) => onEdit(e, index)}
        rows={2}
        className="flex-grow bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <Button
        type="button"
        onClick={() => onDelete(index)}
        variant="ghost"
        className="text-red-400 hover:text-red-300 hover:bg-gray-700"
      >
        <i className="fas fa-trash-alt"></i>
      </Button>
    </div>
  );
};

export default DraggableSceneItem;