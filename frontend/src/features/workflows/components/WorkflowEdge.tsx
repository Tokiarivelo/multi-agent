import { BaseEdge, getBezierPath, EdgeProps, EdgeLabelRenderer } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { memo } from 'react';

export const WorkflowEdge = memo(
  ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style,
    markerEnd,
    selected,
  }: EdgeProps) => {
    const [edgePath, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });

    return (
      <>
        <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className={cn(
              'nodrag nopan transition-opacity duration-200',
              selected
                ? 'opacity-100 z-50'
                : 'opacity-0 hover:opacity-100 focus-within:opacity-100 z-10',
            )}
          >
            <Button
              size="icon"
              variant="outline"
              className="w-5 h-5 rounded-full bg-background border-border shadow-sm text-muted-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                window.dispatchEvent(
                  new CustomEvent('workflow-split-edge', {
                    detail: { edgeId: id },
                  }),
                );
              }}
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        </EdgeLabelRenderer>
      </>
    );
  },
);

WorkflowEdge.displayName = 'WorkflowEdge';
