import { toast } from "@/components/ui/toast";

export type UndoToastOptions = {
  title: string;
  onUndo: () => void;
};

export function showUndoToast({ title, onUndo }: UndoToastOptions): void {
  toast.show({
    title,
    tone: "neutral",
    durationMs: 6000,
    action: {
      label: "Undo",
      onClick: onUndo,
    },
  });
}
