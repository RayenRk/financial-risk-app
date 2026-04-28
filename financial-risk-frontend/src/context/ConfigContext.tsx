import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import api from "../api/axios.ts";

interface AppConfig {
  primary_ticker: string;
  primary_display_name: string;
}

const defaultConfig: AppConfig = {
  primary_ticker: "EPAM",
  primary_display_name: "TACTIC",
};

const ConfigContext = createContext<AppConfig>(defaultConfig);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);

  useEffect(() => {
    api
      .get("/config")
      .then((res) => setConfig(res.data))
      .catch(() => setConfig(defaultConfig));
  }, []);

  return (
    <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>
  );
}

export function useConfig(): AppConfig {
  return useContext(ConfigContext);
}
