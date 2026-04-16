import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useData } from "@/context/data-context";
import { CheckCircle2, XCircle } from "lucide-react";

export default function AttendancePrompt() {
  const { getTodayAttendance, markAttendance } = useData();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Slight delay to allow context to load
    const timer = setTimeout(() => {
      const todayRecord = getTodayAttendance();
      if (!todayRecord) {
        setIsOpen(true);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [getTodayAttendance]);

  const handleMark = (status: 'Present' | 'Absent') => {
    markAttendance(status);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Mark Attendance</DialogTitle>
          <DialogDescription>
            Please confirm your attendance status for today to continue.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-4">
          <Button 
            size="lg" 
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-14"
            onClick={() => handleMark('Present')}
          >
            <CheckCircle2 size={24} />
            I am Present
          </Button>
          <Button 
            size="lg" 
            variant="outline" 
            className="w-full gap-2 h-14 border-destructive text-destructive hover:bg-destructive/10"
            onClick={() => handleMark('Absent')}
          >
            <XCircle size={24} />
            I am Absent
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
