import React from "react";

interface AddChildButtonProps {
  onAdd: () => void;
}

export const AddChildButton: React.FC<AddChildButtonProps> = ({ onAdd }) => {
  return (
    <button
      type="button"
      onClick={onAdd}
      className="px-4 py-2 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-500 focus:outline-none focus-visible:ring"
    >
      Dodaj dziecko
    </button>
  );
};
