import { toast } from "sonner";

// Function to show a toast when real data is refreshed
export function showRefreshNotification(completions: any[], views: any[], source: string) {
  // Only show for real data
  if (source !== 'real') return;
  
  const current = { c: completions.length, v: views.length };
  const stored = localStorage.getItem('data-count');
  const previous = stored ? JSON.parse(stored) : null;
  
  // Show notification with comparison
  if (previous) {
    const newCompletions = current.c - previous.c;
    const newViews = current.v - previous.v;
    
    if (newCompletions > 0 || newViews > 0) {
      toast.success("Data Updated", {
        description: `+${newCompletions} completions, +${newViews} views (${current.c} total completions, ${current.v} total views)`,
        duration: 6000,
      });
    } else {
      toast.info("Data Refreshed", {
        description: `No new data (${current.c} completions, ${current.v} views)`,
        duration: 4000,
      });
    }
  } else {
    toast.success("Data Loaded", {
      description: `${current.c} completions and ${current.v} views`,
      duration: 4000,
    });
  }
  
  localStorage.setItem('data-count', JSON.stringify(current));
}
