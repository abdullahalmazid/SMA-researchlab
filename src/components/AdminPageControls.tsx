import { arrayRemove, arrayUnion, doc, setDoc } from "firebase/firestore";
import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/config";
import { type BlockType, type PageBlock } from "../types2";

interface Props {
  pageId: string;
  blocks: PageBlock[];
  onUpdate: () => void;
}

const blockOptions: { type: BlockType; label: string }[] = [
  { type: "hero", label: "Hero Banner" },
  { type: "stats", label: "Statistics Row" },
  { type: "text_section", label: "Text Section" },
  { type: "mission_vision", label: "Mission & Vision" },
  { type: "cta", label: "Call to Action" },
];

const AdminPageControls: React.FC<Props> = ({ pageId, blocks, onUpdate }) => {
  const { role } = useAuth();
  const [adding, setAdding] = useState(false);
  const isAdmin = role === "admin";

  if (!isAdmin) return null;

  const addBlock = async (type: BlockType) => {
    try {
      const newBlock: PageBlock = {
        id: `block_${Date.now()}`,
        type,
        order: blocks.length,
      };

      const ref = doc(db, "siteContent", "content");

      // Use setDoc with merge: true instead of updateDoc
      // This creates the document if it doesn't exist
      await setDoc(
        ref,
        {
          [`${pageId}Blocks`]: arrayUnion(newBlock),
        },
        { merge: true },
      );

      onUpdate();
      setAdding(false);
    } catch (error) {
      console.error("Error adding block:", error);
      alert("Failed to add section. Check console for errors.");
    }
  };

  const removeBlock = async (block: PageBlock) => {
    if (!confirm("Delete this section?")) return;
    try {
      const ref = doc(db, "siteContent", "content");
      await setDoc(
        ref,
        {
          [`${pageId}Blocks`]: arrayRemove(block),
        },
        { merge: true },
      );

      onUpdate();
    } catch (error) {
      console.error("Error removing block:", error);
      alert("Failed to remove section.");
    }
  };

  const moveBlock = async (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= blocks.length) return;

    const newBlocks = [...blocks];
    const removed = newBlocks.splice(index, 1)[0];
    newBlocks.splice(newIndex, 0, removed);

    // Update order property
    const updatedBlocks = newBlocks.map((b, i) => ({ ...b, order: i }));

    try {
      const ref = doc(db, "siteContent", "content");
      // We must set the whole array when reordering
      await setDoc(
        ref,
        {
          [`${pageId}Blocks`]: updatedBlocks,
        },
        { merge: true },
      );

      onUpdate();
    } catch (error) {
      console.error("Error moving block:", error);
      alert("Failed to move section.");
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <div className="bg-white shadow-xl rounded-xl p-2 border border-gray-200 flex flex-col gap-2">
        <button
          onClick={() => setAdding(!adding)}
          className="px-4 py-2 text-xs font-bold rounded-lg text-white"
          style={{ background: "var(--color-primary)" }}
        >
          {adding ? "Cancel" : "+ Add Section"}
        </button>

        {adding && (
          <div className="flex flex-col gap-1 mt-1">
            {blockOptions.map((opt) => (
              <button
                key={opt.type}
                onClick={() => addBlock(opt.type)}
                className="text-left px-3 py-1.5 text-xs rounded bg-gray-50 hover:bg-gray-100"
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPageControls;
