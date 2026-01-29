import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';
import { StudyCard } from '../types';
import { Check, X, RefreshCw } from 'lucide-react';

export const Study = () => {
  const [searchParams] = useSearchParams();
  const graphId = searchParams.get('graph_id');
  const [cards, setCards] = useState<StudyCard[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    loadCards();
  }, [graphId]);

  const loadCards = async () => {
    try {
      setLoading(true);
      const data = await api.study.getCards(graphId || undefined);
      // Shuffle cards
      setCards(data.sort(() => Math.random() - 0.5));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRate = async (quality: number) => {
    if (!cards[currentCardIndex]) return;
    
    try {
      await api.study.updateProgress(cards[currentCardIndex].id, quality);
      
      if (currentCardIndex < cards.length - 1) {
        setCurrentCardIndex(prev => prev + 1);
        setShowAnswer(false);
      } else {
        setFinished(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading study cards...</div>;

  if (cards.length === 0) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Study Session</h2>
        <p className="text-gray-600">No cards found for this graph. Add some nodes and generate cards first!</p>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold mb-4 text-green-600">Session Complete!</h2>
        <p className="text-gray-600 mb-8">You've reviewed all {cards.length} cards.</p>
        <button
          onClick={() => {
            setFinished(false);
            setCurrentCardIndex(0);
            setShowAnswer(false);
            loadCards(); // Reload/Shuffle
          }}
          className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 inline-flex items-center"
        >
          <RefreshCw className="mr-2" size={20} />
          Start New Session
        </button>
      </div>
    );
  }

  const currentCard = cards[currentCardIndex];

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-8 bg-gray-100">
      <div className="w-full max-w-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">Study Mode</h2>
          <span className="text-gray-500">
            Card {currentCardIndex + 1} of {cards.length}
          </span>
        </div>

        <div 
          className="bg-white rounded-xl shadow-lg p-12 min-h-[300px] flex flex-col items-center justify-center cursor-pointer transition-all hover:shadow-xl"
          onClick={() => setShowAnswer(!showAnswer)}
        >
          <div className="text-center">
            <h3 className="text-gray-500 uppercase tracking-wide text-sm font-semibold mb-4">
              {showAnswer ? 'Answer' : 'Question'}
            </h3>
            <p className="text-2xl font-medium text-gray-900">
              {showAnswer ? currentCard.answer : currentCard.question}
            </p>
            {!showAnswer && (
              <p className="mt-8 text-gray-400 text-sm">Click to flip</p>
            )}
          </div>
        </div>

        {showAnswer && (
          <div className="mt-8 grid grid-cols-4 gap-4">
            <button
              onClick={() => handleRate(1)}
              className="bg-red-100 text-red-700 py-3 rounded-lg font-medium hover:bg-red-200 transition-colors"
            >
              Again
            </button>
            <button
              onClick={() => handleRate(3)}
              className="bg-orange-100 text-orange-700 py-3 rounded-lg font-medium hover:bg-orange-200 transition-colors"
            >
              Hard
            </button>
            <button
              onClick={() => handleRate(4)}
              className="bg-blue-100 text-blue-700 py-3 rounded-lg font-medium hover:bg-blue-200 transition-colors"
            >
              Good
            </button>
            <button
              onClick={() => handleRate(5)}
              className="bg-green-100 text-green-700 py-3 rounded-lg font-medium hover:bg-green-200 transition-colors"
            >
              Easy
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
