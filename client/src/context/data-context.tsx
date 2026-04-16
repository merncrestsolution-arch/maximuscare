import React, { createContext, useContext, useState, useEffect } from 'react';
import { Patient, Visit, AttendanceRecord } from '@/lib/types';
import { MOCK_PATIENTS, MOCK_VISITS, MOCK_ATTENDANCE } from '@/lib/mockData';
import { useAuth } from './auth-context';
import { format } from 'date-fns';

interface DataContextType {
  patients: Patient[];
  visits: Visit[];
  attendance: AttendanceRecord[];
  addPatient: (patient: Omit<Patient, 'id'>) => void;
  addVisit: (visit: Omit<Visit, 'id'>) => void;
  updatePatient: (patient: Patient) => void;
  updateVisit: (visit: Visit) => void;
  deleteVisit: (visitId: string) => void;
  markAttendance: (status: 'Present' | 'Absent') => void;
  checkoutAttendance: () => void;
  saveOvertimeHours: (hours: number) => void;
  getTodayAttendance: () => AttendanceRecord | undefined;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);

  // Load initial data
  useEffect(() => {
    const lsPatients = localStorage.getItem('maximus_patients');
    const lsVisits = localStorage.getItem('maximus_visits');
    const lsAttendance = localStorage.getItem('maximus_attendance');

    setPatients(lsPatients ? JSON.parse(lsPatients) : MOCK_PATIENTS);
    setVisits(lsVisits ? JSON.parse(lsVisits) : MOCK_VISITS);
    setAttendance(lsAttendance ? JSON.parse(lsAttendance) : MOCK_ATTENDANCE);
  }, []);

  // Sync to LS whenever data changes
  useEffect(() => { localStorage.setItem('maximus_patients', JSON.stringify(patients)); }, [patients]);
  useEffect(() => { localStorage.setItem('maximus_visits', JSON.stringify(visits)); }, [visits]);
  useEffect(() => { localStorage.setItem('maximus_attendance', JSON.stringify(attendance)); }, [attendance]);

  const addPatient = (newPatient: Omit<Patient, 'id'>) => {
    const patientWithId = { ...newPatient, id: Math.random().toString(36).substr(2, 9) };
    setPatients(prev => [patientWithId, ...prev]);
  };

  const addVisit = (newVisit: Omit<Visit, 'id'>) => {
    const visitWithId = { ...newVisit, id: Math.random().toString(36).substr(2, 9) };
    setVisits(prev => [visitWithId, ...prev]);
  };

  const updatePatient = (updatedPatient: Patient) => {
    setPatients(prev => prev.map(p => p.id === updatedPatient.id ? updatedPatient : p));
  };

  const updateVisit = (updatedVisit: Visit) => {
    setVisits(prev => prev.map(v => v.id === updatedVisit.id ? updatedVisit : v));
  };

  const deleteVisit = (visitId: string) => {
    setVisits(prev => prev.filter(v => v.id !== visitId));
  };

  const markAttendance = (status: 'Present' | 'Absent') => {
    if (!user) return;
    const today = format(new Date(), 'yyyy-MM-dd');

    const existing = attendance.find(a => a.staffId === user.id && a.date === today);
    if (existing) return;

    const newRecord: AttendanceRecord = {
      id: Math.random().toString(36).substr(2, 9),
      staffId: user.id,
      staffName: user.name,
      role: user.role,
      date: today,
      status,
      checkInTime: status === 'Present' ? new Date().toISOString() : undefined,
    };

    setAttendance(prev => [newRecord, ...prev]);
  };

  const checkoutAttendance = () => {
    if (!user) return;
    const today = format(new Date(), 'yyyy-MM-dd');

    setAttendance(prev => prev.map(a => {
      if (a.staffId === user.id && a.date === today && a.status === 'Present' && !a.checkOutTime) {
        return { ...a, checkOutTime: new Date().toISOString() };
      }
      return a;
    }));
  };

  const saveOvertimeHours = (hours: number) => {
    if (!user) return;
    const today = format(new Date(), 'yyyy-MM-dd');

    setAttendance(prev => prev.map(a => {
      if (a.staffId === user.id && a.date === today && a.status === 'Present') {
        return { ...a, overtimeHours: hours };
      }
      return a;
    }));
  };

  const getTodayAttendance = () => {
    if (!user) return undefined;
    const today = format(new Date(), 'yyyy-MM-dd');
    return attendance.find(a => a.staffId === user.id && a.date === today);
  };

  return (
    <DataContext.Provider value={{ patients, visits, attendance, addPatient, addVisit, updatePatient, updateVisit, deleteVisit, markAttendance, checkoutAttendance, saveOvertimeHours, getTodayAttendance }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
