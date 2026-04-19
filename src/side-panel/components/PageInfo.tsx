import { formatUrlForDisplay } from '../../utils/shared';
import type { PageInfo as PageInfoType } from '../hooks/useChatStream';

interface Props {
  pageInfo: PageInfoType | null;
}

export default function PageInfo({ pageInfo }: Props) {
  if (!pageInfo?.pageUrl) return null;

  const { displayText, faviconUrl } = formatUrlForDisplay(pageInfo.pageUrl);

  return (
    <div className="side-panel-page-info">
      <a href={pageInfo.pageUrl} target="_blank" rel="noopener noreferrer" className="side-panel-page-url" title={pageInfo.pageUrl}>
        {faviconUrl && (
          <img src={faviconUrl} alt="" className="side-panel-page-url-favicon" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        )}
        <span>{displayText}</span>
      </a>
    </div>
  );
}
