import React from "react";

interface EmptyChildrenStateProps {
  onAddChild: () => void;
}

export const EmptyChildrenState: React.FC<EmptyChildrenStateProps> = ({ onAddChild }) => {
  return (
    <div className="flex flex-col items-center justify-center border rounded-md p-10 text-center">
      <h2 className="text-xl font-semibold mb-2">Brak dzieci w Twoim profilu</h2>
      <p className="text-sm text-gray-600 mb-6 max-w-md">
        Dodaj pierwsze dziecko, aby móc przeglądać dostępne zajęcia i zapisy.
      </p>
      <button
        type="button"
        onClick={onAddChild}
        className="px-5 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 focus:outline-none focus-visible:ring"
        data-testid="empty-children-add-child-button"
      >
        Dodaj dziecko
      </button>
    </div>
  );
};
