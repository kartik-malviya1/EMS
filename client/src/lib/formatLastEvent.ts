export interface FormattedEvent {
  label: string;
  className: string;
}

export const formatLastEvent = (
  event: string | null | undefined
): FormattedEvent => {
  if (!event) {
    return {
      label: 'No Events',
      className: 'bg-muted text-muted-foreground border-border',
    };
  }

  switch (event.toLowerCase()) {
    case 'delivered':
      return {
        label: 'Delivered',
        className:
          'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
      };
    case 'bounced':
      return {
        label: 'Bounced',
        className:
          'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
      };
    case 'complained':
      return {
        label: 'Complained',
        className:
          'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
      };
    case 'delivery_delayed':
    case 'delayed':
      return {
        label: 'Delayed',
        className:
          'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
      };
    case 'opened':
      return {
        label: 'Opened',
        className:
          'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
      };
    case 'clicked':
      return {
        label: 'Clicked',
        className:
          'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
      };
    case 'sent':
      return {
        label: 'Sent',
        className:
          'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
      };
    default:
      return {
        label: event.charAt(0).toUpperCase() + event.slice(1),
        className:
          'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
      };
  }
};
