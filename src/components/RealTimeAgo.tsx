import { useEffect, useState } from "react";
import { timeAgo } from "@/lib/format";

export const RealTimeAgo = ({ date }: { date: string | undefined | null }) => {
  const [time, setTime] = useState(() => (date ? timeAgo(date) : ""));

  useEffect(() => {
    if (!date) return;
    setTime(timeAgo(date));
    
    // Update the time every 5 seconds
    const interval = setInterval(() => {
      setTime(timeAgo(date));
    }, 5000);
    
    return () => clearInterval(interval);
  }, [date]);

  return <>{time}</>;
};
