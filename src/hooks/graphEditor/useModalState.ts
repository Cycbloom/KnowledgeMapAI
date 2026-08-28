import { useState } from 'react';

export interface ModalState {
  isPodcastModalOpen: boolean;
  setIsPodcastModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isSettingsOpen: boolean;
  setIsSettingsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isChatOpen: boolean;
  setIsChatOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isExportMenuOpen: boolean;
  setIsExportMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isExportImageModalOpen: boolean;
  setIsExportImageModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isExportPDFOpen: boolean;
  setIsExportPDFOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isShareModalOpen: boolean;
  setIsShareModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isHelpOpen: boolean;
  setIsHelpOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isConnectionSuggestionsOpen: boolean;
  setIsConnectionSuggestionsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const useModalState = (): ModalState => {
  const [isPodcastModalOpen, setIsPodcastModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExportImageModalOpen, setIsExportImageModalOpen] = useState(false);
  const [isExportPDFOpen, setIsExportPDFOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isConnectionSuggestionsOpen, setIsConnectionSuggestionsOpen] =
    useState(false);

  return {
    isPodcastModalOpen,
    setIsPodcastModalOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    isChatOpen,
    setIsChatOpen,
    isExportMenuOpen,
    setIsExportMenuOpen,
    isExportImageModalOpen,
    setIsExportImageModalOpen,
    isExportPDFOpen,
    setIsExportPDFOpen,
    isShareModalOpen,
    setIsShareModalOpen,
    isHelpOpen,
    setIsHelpOpen,
    isConnectionSuggestionsOpen,
    setIsConnectionSuggestionsOpen,
  };
};
