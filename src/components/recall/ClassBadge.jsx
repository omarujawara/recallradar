import { Badge } from "@/components/ui/badge"
import { CLASSIFICATION_INFO } from "@/constants";

const VARIANTS = {
  'Class I': { variant: 'destructive', className: '' },
  'Class II': {
    variant: 'outline',
    className: 'border-transparent bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200',
  },
  'Class III': { variant: 'secondary', className: '' },
};

export default function ClassBadge({ classification }) {
  const info = CLASSIFICATION_INFO[classification] ?? CLASSIFICATION_INFO['Not Yet Classified'];
  const style = VARIANTS[classification] ?? { variant: 'outline', className: '' };

  return (
    <Badge variant={style.variant} className={style.className} title={info.description}>
      {info.label}
    </Badge>
  );
}