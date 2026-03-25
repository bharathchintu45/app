import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { GroupCart, GroupOrderDraft } from '../types';

interface CartContextType {
  regularCart: Record<string, number>;
  setRegularCart: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  groupCart: GroupCart;
  setGroupCart: React.Dispatch<React.SetStateAction<GroupCart>>;
  groupDraft: GroupOrderDraft;
  setGroupDraft: React.Dispatch<React.SetStateAction<GroupOrderDraft>>;
  addToRegularCart: (itemId: string) => void;
  removeFromRegularCart: (itemId: string) => void;
  clearRegularCart: () => void;
  updateGroupCart: (itemId: string, qty: number) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [regularCart, setRegularCart] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem("tfb_regular_cart");
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [groupCart, setGroupCart] = useState<GroupCart>(() => {
    try {
      const saved = localStorage.getItem("tfb_group_cart");
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [groupDraft, setGroupDraft] = useState<GroupOrderDraft>(() => {
    try {
      const saved = localStorage.getItem("tfb_group_draft");
      return saved ? JSON.parse(saved) : { people: 10, deliveryAt: "", notes: "" };
    } catch (e) {
      return { people: 10, deliveryAt: "", notes: "" };
    }
  });

  // Persistence
  useEffect(() => {
    localStorage.setItem("tfb_regular_cart", JSON.stringify(regularCart));
  }, [regularCart]);

  useEffect(() => {
    localStorage.setItem("tfb_group_cart", JSON.stringify(groupCart));
  }, [groupCart]);

  useEffect(() => {
    localStorage.setItem("tfb_group_draft", JSON.stringify(groupDraft));
  }, [groupDraft]);

  const addToRegularCart = useCallback((itemId: string) => {
    setRegularCart(prev => ({
      ...prev,
      [itemId]: (prev[itemId] || 0) + 1
    }));
  }, []);

  const removeFromRegularCart = useCallback((itemId: string) => {
    setRegularCart(prev => {
      const next = { ...prev };
      if (next[itemId] > 1) {
        next[itemId] -= 1;
      } else {
        delete next[itemId];
      }
      return next;
    });
  }, []);

  const clearRegularCart = useCallback(() => {
    setRegularCart({});
  }, []);

  const updateGroupCart = useCallback((itemId: string, qty: number) => {
    setGroupCart(prev => {
      if (qty <= 0) {
        const next = { ...prev };
        delete next[itemId];
        return next;
      }
      return { ...prev, [itemId]: qty };
    });
  }, []);

  return (
    <CartContext.Provider value={{ 
      regularCart, setRegularCart, 
      groupCart, setGroupCart, 
      groupDraft, setGroupDraft,
      addToRegularCart, removeFromRegularCart, clearRegularCart,
      updateGroupCart
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
