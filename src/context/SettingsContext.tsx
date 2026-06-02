import React, { createContext, useContext, useEffect, useState } from 'react';
import { dbService } from '../services/db';
import type { GeneralSettingsDocument } from '../types';

type SettingsContextType = {
  settings: GeneralSettingsDocument | null;
  loading: boolean;
  refreshSettings: () => Promise<void>;
  setSettings: React.Dispatch<React.SetStateAction<GeneralSettingsDocument | null>>;
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<GeneralSettingsDocument | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSettings = async () => {
    setLoading(true);
    try {
      const appSettings = await dbService.getSettings();
      setSettings(appSettings);
    } catch (error) {
      console.error('Failed to load app settings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshSettings();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings, setSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
