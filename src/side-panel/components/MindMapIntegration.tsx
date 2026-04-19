import { MindMapFullscreen } from '../../components/MindMap';

interface Props {
  mindMapMarkdown: string | null;
  onClose: () => void;
}

export default function MindMapIntegration({ mindMapMarkdown, onClose }: Props) {
  if (!mindMapMarkdown) return null;

  return <MindMapFullscreen markdown={mindMapMarkdown} onClose={onClose} />;
}
