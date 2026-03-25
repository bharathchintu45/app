import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { HoldsMap, PlanMap, StartDateMap, TargetMap } from '../types';
import type { SlotAddons } from '../components/dashboard/AddonPopup';

/** date-key → SlotAddons for that day */
export type DateSlotAddons = Record<string, SlotAddons>;

interface PlanContextType {
  holds: HoldsMap;
  setHolds: React.Dispatch<React.SetStateAction<HoldsMap>>;
  planMap: PlanMap;
  setPlanMap: React.Dispatch<React.SetStateAction<PlanMap>>;
  startDates: StartDateMap;
  setStartDates: React.Dispatch<React.SetStateAction<StartDateMap>>;
  targetMap: TargetMap;
  setTargetMap: React.Dispatch<React.SetStateAction<TargetMap>>;
  subscription: string;
  setSubscription: React.Dispatch<React.SetStateAction<string>>;
  dateSlotAddons: DateSlotAddons;
  setDateSlotAddons: React.Dispatch<React.SetStateAction<DateSlotAddons>>;
  clearPlanningState: () => void;
}

const PlanContext = createContext<PlanContextType | undefined>(undefined);

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const [holds, setHolds] = useState<HoldsMap>(() => {
    try {
      const saved = localStorage.getItem("tfb_holds");
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [planMap, setPlanMap] = useState<PlanMap>(() => {
    try {
      const saved = localStorage.getItem("tfb_plan_map");
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [startDates, setStartDates] = useState<StartDateMap>(() => {
    try {
      const saved = localStorage.getItem("tfb_start_dates");
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [targetMap, setTargetMap] = useState<TargetMap>(() => {
    try {
      const saved = localStorage.getItem("tfb_target_map");
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [dateSlotAddons, setDateSlotAddons] = useState<DateSlotAddons>(() => {
    try {
      const saved = localStorage.getItem("tfb_date_slot_addons");
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [subscription, setSubscription] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("tfb_subscription");
      return saved || 'complete-7'; // Default fallback
    } catch (e) {
      return 'complete-7';
    }
  });

  // Persistence
  useEffect(() => {
    localStorage.setItem("tfb_holds", JSON.stringify(holds));
  }, [holds]);

  useEffect(() => {
    localStorage.setItem("tfb_plan_map", JSON.stringify(planMap));
  }, [planMap]);

  useEffect(() => {
    localStorage.setItem("tfb_start_dates", JSON.stringify(startDates));
  }, [startDates]);

  useEffect(() => {
    localStorage.setItem("tfb_target_map", JSON.stringify(targetMap));
  }, [targetMap]);

  useEffect(() => {
    localStorage.setItem("tfb_date_slot_addons", JSON.stringify(dateSlotAddons));
  }, [dateSlotAddons]);

  useEffect(() => {
    localStorage.setItem("tfb_subscription", subscription);
  }, [subscription]);

  const clearPlanningState = useCallback(() => {
    setHolds({});
    setPlanMap({});
    setStartDates({});
    setTargetMap({});
    setDateSlotAddons({});
    setSubscription('complete-7');
    localStorage.removeItem("tfb_holds");
    localStorage.removeItem("tfb_plan_map");
    localStorage.removeItem("tfb_start_dates");
    localStorage.removeItem("tfb_target_map");
    localStorage.removeItem("tfb_date_slot_addons");
    localStorage.removeItem("tfb_subscription");
  }, []);

  return (
    <PlanContext.Provider value={{ 
      holds, setHolds, 
      planMap, setPlanMap, 
      startDates, setStartDates, 
      targetMap, setTargetMap,
      subscription, setSubscription,
      dateSlotAddons, setDateSlotAddons,
      clearPlanningState
    }}>
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  const context = useContext(PlanContext);
  if (context === undefined) {
    throw new Error('usePlan must be used within a PlanProvider');
  }
  return context;
}
