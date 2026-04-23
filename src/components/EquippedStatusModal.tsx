import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';
import { X, HardHat, Shirt, Hand, PersonStanding, Footprints, Sword } from 'lucide-react';
import { audioService } from '../lib/audioService';
import { ITEMS } from '../gameData';
import { resolveIconComponent } from '../lib/iconRegistry';

type GearSlot = 'head' | 'torso' | 'hands' | 'legs' | 'feet';
type WeaponHand = 'left' | 'right';

interface EquippedStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  gear: Partial<Record<GearSlot, string>>;
  weapons: Partial<Record<WeaponHand, string>>;
  inventory: string[];
  equippedItemIds: string[];
  onEquipItem: (itemId: string) => void;
}

export default function EquippedStatusModal({
  isOpen,
  onClose,
  gear,
  weapons,
  inventory,
  equippedItemIds,
  onEquipItem,
}: EquippedStatusModalProps) {
  const hoverUi = () => audioService.playHoverThrottled();
  const owned = (id: string) => Boolean(ITEMS[id]);
  const allEquipment = Array.from(
    new Set(
      ([
        ...Object.values(gear),
        ...Object.values(weapons),
        ...inventory,
      ] as Array<string | undefined>).filter((x): x is string => Boolean(x) && owned(x)),
    ),
  )
    .map((id) => ({ id, item: ITEMS[id] }))
    .filter(({ item }) => {
      const t = item.itemType ?? (item.equippable ? 'gear' : 'misc');
      return t === 'gear' || t === 'weapon';
    })
    .sort((a, b) => (a.item.name ?? a.id).localeCompare(b.item.name ?? b.id));

  const hasAnyWeaponSlot = useMemo(() => {
    if (weapons.left || weapons.right) return true;
    return allEquipment.some(({ item }) => item.itemType === 'weapon');
  }, [allEquipment, weapons.left, weapons.right]);
  const hasAnyHeadSlot = useMemo(() => {
    if (gear.head) return true;
    return allEquipment.some(({ item }) => (item.gearSlot ?? item.equipmentSlot) === 'head');
  }, [allEquipment, gear.head]);
  const hasAnyHandsSlot = useMemo(() => {
    if (gear.hands) return true;
    return allEquipment.some(({ item }) => (item.gearSlot ?? item.equipmentSlot) === 'hands');
  }, [allEquipment, gear.hands]);
  const hasAvailableGear = useMemo(() => {
    const inventorySet = new Set(inventory);
    const has = (slot: GearSlot) =>
      allEquipment.some(({ id, item }) => inventorySet.has(id) && (item.gearSlot ?? item.equipmentSlot) === slot);
    return {
      head: has('head'),
      torso: has('torso'),
      hands: has('hands'),
      legs: has('legs'),
      feet: has('feet'),
    };
  }, [allEquipment, inventory]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[210] flex items-start justify-center overflow-y-auto overscroll-y-contain p-3 sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 16 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.98, opacity: 0, y: 10 }}
            className="relative z-10 my-2 w-full max-h-[calc(100dvh-2rem)] max-w-3xl overflow-x-hidden overflow-y-auto border-4 border-[#35ebeb] bg-[#1b1b1b] p-6 sm:my-0 sm:p-8"
          >
            <div className="absolute -left-1 -top-1 h-4 w-4 bg-[#35ebeb]" />
            <div className="absolute -right-1 -top-1 h-4 w-4 bg-[#35ebeb]" />
            <div className="absolute -bottom-1 -left-1 h-4 w-4 bg-[#35ebeb]" />
            <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-[#35ebeb]" />

            <div className="mb-6 flex items-start justify-between gap-4">
              <h2 className="text-xl font-black uppercase tracking-widest text-[#ffaaf6]">Equipment</h2>
              <button
                type="button"
                onMouseEnter={hoverUi}
                onClick={onClose}
                className="text-[#35ebeb] hover:text-white"
                aria-label="Close"
              >
                <X size={24} />
              </button>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="border border-[#353535] bg-[#131313] p-4">
                <div className="mb-3 text-[10px] font-black uppercase tracking-widest text-[#35ebeb]">EQUIPPED</div>
                <div className="relative mx-auto flex h-72 w-full max-w-sm items-center justify-center">
                  <img
                    src="/assets/body-silhouette.svg"
                    alt=""
                    className="pointer-events-none absolute h-[95%] max-h-[17rem] w-auto max-w-full select-none object-contain opacity-[0.12]"
                  />
                  {/* slot boxes */}
                  {hasAnyHeadSlot && (
                    <div
                      className={clsx(
                        'absolute left-1/2 top-2 -translate-x-1/2 border bg-[#1b1b1b] p-2',
                        gear.head || !hasAvailableGear.head ? 'border-[#353535]' : 'border-[#35ebeb]',
                      )}
                    >
                      <HardHat size={18} className={gear.head ? 'text-[#35ebeb]' : 'text-[#e2e2e2]/25'} />
                    </div>
                  )}
                  <div
                    className={clsx(
                      'absolute left-1/2 top-[85px] -translate-x-1/2 border bg-[#1b1b1b] p-2',
                      gear.torso || !hasAvailableGear.torso ? 'border-[#353535]' : 'border-[#35ebeb]',
                    )}
                  >
                    <Shirt size={18} className={gear.torso ? 'text-[#35ebeb]' : 'text-[#e2e2e2]/25'} />
                  </div>
                  {hasAnyWeaponSlot && (
                    <div className="absolute right-[80px] top-[115px] border border-[#353535] bg-[#1b1b1b] p-2">
                      <Sword size={18} className={weapons.left ? 'text-[#35ebeb]' : 'text-[#e2e2e2]/25'} />
                    </div>
                  )}
                  {hasAnyWeaponSlot && (
                    <div className="absolute left-[50px] right-auto top-[78px] border border-[#353535] bg-[#1b1b1b] p-2">
                      <Sword size={18} className={weapons.right ? 'text-[#35ebeb]' : 'text-[#e2e2e2]/25'} />
                    </div>
                  )}
                  <div
                    className={clsx(
                      'absolute left-1/2 top-[150px] -translate-x-1/2 border bg-[#1b1b1b] p-2',
                      gear.legs || !hasAvailableGear.legs ? 'border-[#353535]' : 'border-[#35ebeb]',
                    )}
                  >
                    <PersonStanding size={18} className={gear.legs ? 'text-[#35ebeb]' : 'text-[#e2e2e2]/25'} />
                  </div>
                  {hasAnyHandsSlot && (
                    <div
                      className={clsx(
                        'absolute right-[50px] top-[78px] border bg-[#1b1b1b] p-2',
                        gear.hands || !hasAvailableGear.hands ? 'border-[#353535]' : 'border-[#35ebeb]',
                      )}
                    >
                      <Hand size={18} className={gear.hands ? 'text-[#35ebeb]' : 'text-[#e2e2e2]/25'} />
                    </div>
                  )}
                  <div
                    className={clsx(
                      'absolute bottom-[40px] left-1/2 -translate-x-1/2 border bg-[#1b1b1b] p-2',
                      gear.feet || !hasAvailableGear.feet ? 'border-[#353535]' : 'border-[#35ebeb]',
                    )}
                  >
                    <Footprints size={18} className={gear.feet ? 'text-[#35ebeb]' : 'text-[#e2e2e2]/25'} />
                  </div>
                </div>
              </div>

              <div className="border border-[#353535] bg-[#131313] p-4">
                <div className="mb-3 text-[10px] font-black uppercase tracking-widest text-[#35ebeb]">gear</div>
                <div className="max-h-[22rem] space-y-2 overflow-y-auto pr-1">
                  {allEquipment.length ? (
                    allEquipment.map(({ id, item }) => {
                      const equipped = equippedItemIds.includes(id);
                      const RowIcon = resolveIconComponent(item.icon) as React.ComponentType<{
                        size?: number;
                        className?: string;
                      }>;
                      const slotLabel =
                        item.itemType === 'weapon'
                          ? `${item.weaponHand ?? 'right'} hand`
                          : item.gearSlot ?? item.equipmentSlot ?? 'gear';
                      const canEquip = !equipped && inventory.includes(id);
                      return (
                        <div key={id} className="flex items-start gap-3 border-l-4 border-[#35ebeb] bg-[#1b1b1b] p-3">
                          <div className="mt-1 text-[#35ebeb]">
                            <RowIcon size={16} className={item.itemType === 'weapon' ? 'opacity-100' : 'opacity-90'} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-3">
                              <div className="truncate text-sm font-bold uppercase text-[#ffffff]">{item.name}</div>
                              {equipped ? (
                                <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-[#ffaaf6]">
                                  EQUIPPED
                                </span>
                              ) : canEquip ? (
                                <button
                                  type="button"
                                  onMouseEnter={hoverUi}
                                  onClick={() => {
                                    audioService.playSound('click');
                                    onEquipItem(id);
                                  }}
                                  className="shrink-0 border border-[#35ebeb] px-2 py-1 text-[10px] font-black uppercase tracking-widest text-[#35ebeb] hover:bg-[#35ebeb] hover:text-[#002020]"
                                >
                                  equip
                                </button>
                              ) : null}
                            </div>
                            <div className="mt-1 text-[10px] uppercase tracking-widest text-[#e2e2e2]/60">
                              {slotLabel}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-[10px] italic uppercase tracking-widest text-[#e2e2e2]/40">
                      No gear yet...
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onMouseEnter={hoverUi}
              onClick={onClose}
              className="mt-8 w-full border-2 border-[#35ebeb] py-3 text-xs font-black uppercase tracking-widest text-[#35ebeb] hover:bg-[#35ebeb] hover:text-[#002020]"
            >
              CLOSE
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
