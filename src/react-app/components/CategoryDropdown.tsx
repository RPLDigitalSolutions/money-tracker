import { useState } from "react";
import { Check, X, Pencil, Trash2, Plus } from "lucide-react";
export function CategoryDropdown({
  availableCategories,
  category,
  setCategory,
  isDropdownOpen,
  setIsDropdownOpen,
  setIsNewCategory,
  onEditCategory,
  onDeleteCategory,
  isCategoryUsed
}: {
  availableCategories: string[];
  category: string;
  setCategory: (c: string) => void;
  isDropdownOpen: boolean;
  setIsDropdownOpen: (isOpen: boolean) => void;
  setIsNewCategory: (isNew: boolean) => void;
  onEditCategory?: (oldCat: string, newCat: string) => void;
  onDeleteCategory?: (cat: string) => void;
  isCategoryUsed?: (cat: string) => boolean;
}) {
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editingCategoryValue, setEditingCategoryValue] = useState("");
  if (!isDropdownOpen) return null;
  return (
    <>
      <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)}></div>
      <div className="absolute top-full left-0 right-0 mt-2 max-h-60 overflow-hidden rounded-xl border border-white/10 bg-neutral-900/60 backdrop-blur-xl shadow-2xl z-20 animate-in fade-in zoom-in-95 duration-100 flex flex-col ring-1 ring-white/5">
        <div className="overflow-y-auto scrollbar-none py-1 px-1 space-y-0.5 max-h-[200px]">
          {availableCategories.map(c => (
            <div key={c} className="group relative flex items-center w-full">
              {editingCategory === c ? (
                 <div className="flex items-center w-full px-2 py-1.5 gap-2 bg-neutral-800 rounded-lg">
                    <input 
                       autoFocus
                       value={editingCategoryValue}
                       onChange={e => setEditingCategoryValue(e.target.value)}
                       onKeyDown={e => {
                          if (e.key === 'Enter') {
                             e.preventDefault();
                             e.stopPropagation();
                             if (onEditCategory) onEditCategory(c, editingCategoryValue);
                             setCategory(editingCategoryValue);
                             setEditingCategory(null);
                          } else if (e.key === 'Escape') {
                             setEditingCategory(null);
                          }
                       }}
                       className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                    <button type="button" onClick={(e) => { e.stopPropagation(); if (onEditCategory) onEditCategory(c, editingCategoryValue); setCategory(editingCategoryValue); setEditingCategory(null); }} className="p-1 text-emerald-400 hover:text-emerald-300">
                       <Check className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setEditingCategory(null); }} className="p-1 text-zinc-400 hover:text-zinc-200">
                       <X className="h-4 w-4" />
                    </button>
                 </div>
              ) : (
                 <>
                   <button
                      type="button"
                      onClick={() => { setCategory(c); setIsDropdownOpen(false); }}
                      className={`w-full text-left pl-3 pr-16 py-2.5 rounded-lg flex items-center justify-between text-sm transition-all ${
                        category === c 
                          ? 'bg-neutral-800 text-emerald-400 font-medium' 
                          : 'text-zinc-400 hover:bg-neutral-800 hover:text-zinc-200'
                      }`}
                   >
                     <span className="truncate">{c}</span>
                   </button>
                   <div className="absolute right-2 flex items-center gap-1">
                     <button 
                        type="button" 
                        onClick={(e) => { 
                           e.stopPropagation(); 
                           setEditingCategory(c); 
                           setEditingCategoryValue(c); 
                        }} 
                        className="p-1.5 text-zinc-400 hover:text-blue-400 rounded-md hover:bg-white/10"
                     >
                       <Pencil className="h-3 w-3" />
                     </button>
                     <button 
                        type="button" 
                        onClick={(e) => { 
                           e.stopPropagation(); 
                           if (isCategoryUsed && isCategoryUsed(c)) {
                             alert("Kategori ini sedang digunakan oleh transaksi dan tidak dapat dihapus.");
                             return;
                           }
                           if (confirm(`Delete category "${c}"?`)) {
                              if (onDeleteCategory) onDeleteCategory(c);
                              if (category === c) setCategory("");
                           }
                        }} 
                        className={`p-1.5 rounded-md transition-colors ${
                          isCategoryUsed && isCategoryUsed(c)
                            ? 'text-zinc-600 cursor-not-allowed'
                            : 'text-zinc-400 hover:text-red-400 hover:bg-white/10'
                        }`}
                        title={isCategoryUsed && isCategoryUsed(c) ? "Kategori sedang digunakan" : "Hapus kategori"}
                     >
                       <Trash2 className="h-3 w-3" />
                     </button>
                   </div>
                 </>
              )}
            </div>
          ))}
        </div>
        <div className="p-1.5 border-t border-white/5 bg-neutral-900/50 backdrop-blur-sm">
          <button
              type="button"
              onClick={() => { setIsNewCategory(true); setCategory(""); setIsDropdownOpen(false); }}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-black font-semibold bg-white hover:bg-zinc-200 transition-all text-xs shadow-md"
          >
              <Plus className="h-3.5 w-3.5" />
              New Category
          </button>
        </div>
      </div>
    </>
  );
}
