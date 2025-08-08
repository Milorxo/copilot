import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, Copy, Check } from 'lucide-react';

export const Feedback = ({ answerId, contentToCopy }: { answerId: string; contentToCopy: string; }) => {
  const [feedback, setFeedback] = useState<'like' | 'dislike' | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const handleFeedback = (type: 'like' | 'dislike') => {
    if (feedback === type) {
      setFeedback(null); // Deselect
    } else {
      setFeedback(type);
    }
  };

  const handleCopy = () => {
    if (isCopied || !contentToCopy) return;
    navigator.clipboard.writeText(contentToCopy).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000); // Revert icon after 2 seconds
    }).catch(err => {
      console.error('Failed to copy reply:', err);
    });
  };

  return (
    <div className="flex items-center space-x-1">
      <button
        onClick={handleCopy}
        disabled={isCopied}
        className={`p-1.5 rounded-full transition-all duration-200 transform hover:scale-110 disabled:scale-100 ${
          isCopied
            ? 'bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400 cursor-default'
            : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-gray-700/60'
        }`}
        aria-label={isCopied ? "Copied to clipboard" : "Copy reply"}
      >
        {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
      <button
        onClick={() => handleFeedback('like')}
        className={`p-1.5 rounded-full transition-all duration-200 transform hover:scale-110 ${
          feedback === 'like' 
            ? 'bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400' 
            : 'text-gray-400 hover:text-green-500 hover:bg-green-100/50 dark:hover:text-green-400 dark:hover:bg-green-500/20'
        }`}
        aria-label="Good answer"
      >
        <ThumbsUp className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => handleFeedback('dislike')}
        className={`p-1.5 rounded-full transition-all duration-200 transform hover:scale-110 ${
          feedback === 'dislike' 
            ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' 
            : 'text-gray-400 hover:text-red-500 hover:bg-red-100/50 dark:hover:text-red-400 dark:hover:bg-red-500/20'
        }`}
        aria-label="Bad answer"
      >
        <ThumbsDown className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};