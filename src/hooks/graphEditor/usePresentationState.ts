import { useState } from 'react';

export interface PresentationState {
  isPresentationMode: boolean;
  setIsPresentationMode: React.Dispatch<React.SetStateAction<boolean>>;
  presentationStep: number;
  setPresentationStep: React.Dispatch<React.SetStateAction<number>>;
}

export const usePresentationState = (): PresentationState => {
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [presentationStep, setPresentationStep] = useState(0);

  return {
    isPresentationMode,
    setIsPresentationMode,
    presentationStep,
    setPresentationStep,
  };
};
