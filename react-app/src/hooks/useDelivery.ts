import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface DeliveryBoy {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  is_active: boolean;
  meta?: any;
}

export interface DeliveryAssignment {
  id: string;
  order_id: string;
  delivery_boy_id: string;
  status: 'assigned' | 'picked_up' | 'out_for_delivery' | 'delivered';
  assigned_at: string;
  meta?: any;
  delivery_boys?: {
    name: string;
    phone: string;
    vehicle: string;
  };
}

export function useDelivery() {
  const [deliveryBoys, setDeliveryBoys] = useState<DeliveryBoy[]>([]);
  const [assignments, setAssignments] = useState<DeliveryAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  async function fetchDeliveryData() {
    try {
      const { data: db } = await supabase.from('delivery_boys').select('*').order('name');
      if (db) setDeliveryBoys(db as DeliveryBoy[]);
      
      const { data: da } = await supabase.from('delivery_assignments').select('*, delivery_boys(name, phone, vehicle)');
      if (da) setAssignments(da as any[]);
    } catch (err) {
      console.error('[useDelivery] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDeliveryData();

    const channel = supabase
      .channel('shared-delivery-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_assignments' }, () => {
        fetchDeliveryData(); // Re-fetch to get joined data on changes
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_boys' }, () => {
        fetchDeliveryData();
      })
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { 
    deliveryBoys, 
    assignments, 
    loading, 
    realtimeConnected, 
    refetch: fetchDeliveryData 
  };
}
