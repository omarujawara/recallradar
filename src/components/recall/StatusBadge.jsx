import { Badge } from "@/components/ui/badge";
import { ACTIVE_STATUSES } from "@/constants";

export default function StatusBadge({ status }) {
  const isActive = ACTIVE_STATUSES.includes(status);
  return (
    <Badge variant={isActive ? 'default' : 'outline'} title={`FDA status: ${status}`}>
      {isActive ? 'Active' : 'Closed'}
    </Badge>
  );
}