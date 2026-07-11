import { arrayRemove, doc, onSnapshot, setDoc } from "firebase/firestore";
import React, { useEffect, useState } from "react";
import AdminPageControls from "../components/AdminPageControls";
import {
  CTABlock,
  HeroBlock,
  MissionVisionBlock,
  StatsBlock,
  TextBlock,
} from "../components/ContentBlocks";
import { useAuth } from "../context/AuthContext";
import { db } from "../firebase/config";
import { type PageBlock } from "../types2";

const DEFAULT_ABOUT_BLOCKS: PageBlock[] = [
  { id: "about-hero", type: "hero", order: 0 },
  { id: "about-overview", type: "text_section", order: 1 },
  { id: "about-mission", type: "mission_vision", order: 2 },
  { id: "about-stats", type: "stats", order: 3 },
  { id: "about-cta", type: "cta", order: 4 },
];

const About: React.FC = () => {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [blocks, setBlocks] = useState<PageBlock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "siteContent", "content"), (snap) => {
      if (snap.exists() && Array.isArray(snap.data().aboutPageBlocks) && snap.data().aboutPageBlocks.length) {
        const sortedBlocks = [...snap.data().aboutPageBlocks].sort(
          (a: PageBlock, b: PageBlock) => a.order - b.order,
        );
        setBlocks(sortedBlocks);
      } else setBlocks(DEFAULT_ABOUT_BLOCKS);
      setLoading(false);
    }, (error) => { console.error("About page error:", error); setBlocks(DEFAULT_ABOUT_BLOCKS); setLoading(false); });
    return () => unsub();
  }, []);

  // --- Admin Actions ---

  const deleteBlock = async (block: PageBlock) => {
    if (!confirm("Are you sure you want to delete this section?")) return;
    try {
      const ref = doc(db, "siteContent", "content");
      await setDoc(
        ref,
        {
          aboutPageBlocks: arrayRemove(block),
        },
        { merge: true },
      );
    } catch (error) {
      console.error("Error deleting block:", error);
      alert("Failed to delete section.");
    }
  };

  const moveBlock = async (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= blocks.length) return;

    const newBlocks = [...blocks];
    // Swap the blocks
    const temp = newBlocks[index];
    newBlocks[index] = newBlocks[newIndex];
    newBlocks[newIndex] = temp;

    // Update the order property
    const updatedBlocks = newBlocks.map((b, i) => ({ ...b, order: i }));

    try {
      const ref = doc(db, "siteContent", "content");
      await setDoc(
        ref,
        {
          aboutPageBlocks: updatedBlocks,
        },
        { merge: true },
      );
    } catch (error) {
      console.error("Error moving block:", error);
    }
  };

  if (loading) return <div className="p-10 text-center">Loading...</div>;

  return (
    <div style={{ background: "var(--color-bg)" }}>
      {blocks.map((block, index) => {
        const props = { blockId: block.id, index };

        return (
          // relative wrapper for positioning context
          <div key={block.id} className="relative">
            {/* --- Render The Block Content First --- */}
            {block.type === "hero" && <HeroBlock {...props} />}
            {block.type === "stats" && <StatsBlock {...props} />}
            {block.type === "text_section" && <TextBlock {...props} />}
            {block.type === "mission_vision" && (
              <MissionVisionBlock {...props} />
            )}
            {block.type === "cta" && <CTABlock {...props} />}

            {/* --- Admin Overlay Controls (Always visible for Admins) --- */}
            {isAdmin && (
              <div className="absolute top-0 right-0 z-50 p-3 flex gap-2">
                <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-1 flex gap-1 border border-gray-200">
                  {/* Move Up Button */}
                  <button
                    onClick={() => moveBlock(index, "up")}
                    disabled={index === 0}
                    className="hover:bg-gray-100 text-gray-700 text-xs font-bold px-2 py-1 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move Up"
                  >
                    ↑
                  </button>

                  {/* Move Down Button */}
                  <button
                    onClick={() => moveBlock(index, "down")}
                    disabled={index === blocks.length - 1}
                    className="hover:bg-gray-100 text-gray-700 text-xs font-bold px-2 py-1 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move Down"
                  >
                    ↓
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={() => deleteBlock(block)}
                    className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded"
                    title="Delete Section"
                  >
                    ✕ Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <AdminPageControls
        pageId="aboutPage"
        blocks={blocks}
        onUpdate={() => {}}
      />
    </div>
  );
};

export default About;
