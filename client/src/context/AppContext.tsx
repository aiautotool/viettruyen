import { createContext, useState, useContext, ReactNode } from 'react';

interface AppContextProps {
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  questionText: string;
  setQuestionText: (text: string) => void;
  selectedSubject: string;
  setSelectedSubject: (subject: string) => void;
}

const defaultContextValue: AppContextProps = {
  selectedFile: null,
  setSelectedFile: () => {},
  questionText: '',
  setQuestionText: () => {},
  selectedSubject: '',
  setSelectedSubject: () => {},
};

export const AppContext = createContext<AppContextProps>(defaultContextValue);

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [questionText, setQuestionText] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');

  return (
    <AppContext.Provider
      value={{
        selectedFile,
        setSelectedFile,
        questionText,
        setQuestionText,
        selectedSubject,
        setSelectedSubject,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);