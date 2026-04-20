import {
  GameState,
  Item,
  Scene,
  GameObject,
  INITIAL_STATE as BASE_INITIAL_STATE,
  REUSE_INTERACTION_EXAMINE,
} from './types';
import { audioService } from './lib/audioService';
import { SCORE_FIRST_ENTER_SCENE, SCORE_PICKUP_ITEM } from './lib/gameScoring';

export const ITEMS: Record<string, Item> = {
  'old_key': {
    id: 'old_key',
    name: 'Old Brass Key',
    description: 'A heavy, tarnished key found in your childhood wardrobe.',
    useText: 'You insert the key into the lock. It turns with a satisfying click.',
    icon: 'Key'
  },
  'quarter': {
    id: 'quarter',
    name: 'Quarter',
    description: 'A quarter you found under the rug in your room.',
    useText: 'You pick up the quarter. It feels like a small reward for your efforts.',
    icon: 'Coins',
  },
  'comic_book': {
    id: 'comic_book',
    name: 'Digital Comic Prototype',
    description: 'A handheld device showing a "Choose Your Own Adventure" comic.',
    useText: 'You flip through the digital pages. It gives you a strange sense of foresight.',
    icon: 'BookOpen'
  },
  'mystic_pendant': {
    id: 'mystic_pendant',
    name: 'Zoltar Pendant',
    description: 'A small gold pendant shaped like a fortune teller machine.',
    useText: 'The pendant glows warmly when you hold it.',
    icon: 'Gem'
  },
  'giants_hoodie': {
    id: 'giants_hoodie',
    name: 'Blue NY Giants Hoodie',
    description: "Your dad's game-day hoodie—faded blue, obnoxiously loyal, and actually sized for an adult.",
    useText: 'You pull on the Giants hoodie. It swallows your shoulders in the best way possible—you finally look less like a sleepover accident.',
    icon: 'Shirt',
    equippable: true,
    equipmentSlot: 'torso',
    wearDescription:
      "You're wearing a blue NY Giants hoodie over your ridiculous dinosaur pajamas. It's not fashion. It's camouflage.",
  },
  'sweatpants_gray': {
    id: 'sweatpants_gray',
    name: 'Gray Sweatpants',
    description: 'Soft gray sweatpants that look like they were stolen from a laundry basket labeled DAD.',
    useText: 'You step into the gray sweatpants. They cinch at the waist and actually reach your ankles.',
    icon: 'Shirt',
    equippable: true,
    equipmentSlot: 'legs',
    wearDescription: 'Gray sweatpants over dinosaur pajama legs—dignity is still on thin ice, but at least your knees are covered.',
  },
  'sneakers_white': {
    id: 'sneakers_white',
    name: 'White Sneakers',
    description: 'A pair of clean white sneakers from the closet shelf—generic, anonymous, and blessedly adult-sized.',
    useText: 'You lace up the sneakers. Your dinosaur feet stop scraping the floorboards.',
    icon: 'Shoe',
    equippable: true,
    equipmentSlot: 'feet',
    wearDescription: 'White sneakers complete the disguise. You still look like a sleepwalker from a sitcom, but a clothed one.',
  },
  'rattle': {
    id: 'rattle',
    name: 'Baby Rattle',
    description: 'A plastic rattle with cheerful primary colors. It feels absurd in your adult hands.',
    useText: 'You give the rattle a cautious shake. It chirps like a tiny tambourine of innocence.',
    icon: 'Circle',
  },
  'flashlight': {
    id: 'flashlight',
    name: 'Durable Flashlight',
    description: 'A heavy-duty flashlight with a strong beam.',
    useText: 'You click the switch. A bright beam of light cuts through the darkness.',
    icon: 'Zap'
  },
  'magic_coin': {
    id: 'magic_coin',
    name: 'Magic Carnival Coin',
    description: 'A heavy silver coin with a star on one side.',
    useText: 'You insert the coin into the machine.',
    icon: 'CircleDollarSign'
  },
  'wizard_staff': {
    id: 'wizard_staff',
    name: 'Staff of the Evil Wizard',
    description: 'A gnarled wooden staff topped with a glowing magenta crystal.',
    useText: 'You channel your energy through the staff.',
    icon: 'Wand2'
  },
  'map': {
    id: 'map',
    name: 'Neighborhood Map',
    description: 'A hand-drawn map showing the way to Sea Point Park.',
    useText: 'You consult the map. The carnival is definitely to the north.',
    icon: 'Map',
  },
  'training_sword': {
    id: 'training_sword',
    name: 'Ice Dwarf Training Sword',
    description: 'A short, notched blade issued by dwarves who have opinions about your stance.',
    useText: 'You swing the training sword. It hums like winter wind.',
    icon: 'Sword',
  },
  'glacial_armor': {
    id: 'glacial_armor',
    name: 'Glacial Battle Armor',
    description: 'Layered furs, ice-threaded mail, and runes that keep your blood moving in killing cold.',
    useText: 'You strap on the glacial armor. The cold outside suddenly feels like a dare, not a death sentence.',
    icon: 'Shield',
    equippable: true,
    equipmentSlot: 'armor',
    wearDescription:
      'Glacial armor turns you into a walking iceberg knight—ridiculous in any living room, perfect for an evil wizard.',
  },
  'thermal_pod': {
    id: 'thermal_pod',
    name: 'Thermal Pod',
    description: 'A humming canister stamped PROPERTY OF ARCADE SCIENCE DEPT.',
    useText: 'You prime the thermal pod. It gets uncomfortably warm in your hands.',
    icon: 'Flame',
  },
  'ice_relic': {
    id: 'ice_relic',
    name: 'The Thawed Relic',
    description: 'An ancient relic the Ice Dwarves have sought for millennia—warm to the touch despite its frost-rimed crown.',
    useText: 'The relic thrums like a heartbeat under glass.',
    icon: 'Gem',
  },
};

export const OBJECTS: Record<string, GameObject> = {
  'wardrobe': {
    id: 'wardrobe',
    name: 'Wardrobe',
    initialState: 'closed',
    /** Door open/closed and whether the brass key is still inside (empty = taken or gone). */
    initialAxes: { door: 'closed', contents: 'key' },
    legacyStateKey: 'door',
    descriptions: {
      'contents:key|door:closed':
        "It's a heavy oak wardrobe. It looks like it might contain something useful.",
      'contents:key|door:open':
        "The wardrobe stands open. Your childhood clothes are still there—and the OLD BRASS KEY is on its hook until you take it.",
      'contents:empty|door:open':
        "It's an opened wardrobe. It holds your childhood clothes, but none of that appears to fit you anymore. The key is gone.",
      'contents:empty|door:closed':
        "The wardrobe is closed. Your clothes are inside; the brass key is no longer on the hook.",
    },
    interactions: [
      {
        id: 'wardrobe_look',
        regex: 'look( at)?( the)? wardrobe',
        text: "It appears to be the only piece of furniture in the room.",
      },
      {
        id: 'wardrobe_open_key',
        regex: '(open( up)?|search|look in(side)?)( the)? wardrobe',
        whenAxes: { door: 'closed', contents: 'key' },
        text: "You open the wardrobe. Inside, you find a red hoodie that looks too small for you in your current condition. You also find an OLD BRASS KEY hanging on a hook.",
        getItem: 'old_key',
        setAxes: { door: 'open', contents: 'empty' },
        playSound: 'wood_creak_open',
      },
      {
        id: 'wardrobe_open_empty',
        regex: '(open( up)?|search|look in(side)?)( the)? wardrobe',
        whenAxes: { door: 'closed', contents: 'empty' },
        text: "You open the wardrobe. Inside, you find that same old red hoodie that doesn't fit you. There's an empty hook with a vague dust outline where a key used to hang—but no key is there. You must've already obtained it.",
        setAxes: { door: 'open' },
        playSound: 'wood_creak_open',
      },
      {
        id: 'wardrobe_open_redundant',
        regex: '(open( up)?|search|look in(side)?)( the)? wardrobe',
        whenAxes: { door: 'open' },
        setAxes: { door: 'open' },
        redundantMessage:
          'The wardrobe is already open. There is nothing else of use to you in the wardrobe.',
      },
      {
        id: 'wardrobe_close',
        regex: 'close( the)? wardrobe',
        text: "You close the wardrobe. It's now closed.",
        setAxes: { door: 'closed' },
        playSound: 'wood_creak_close',
        redundantMessage: "The wardrobe is closed. It can't be closed anymore. You've closed it the most it can be closed.",
      },
      {
        regex: 'rummage (in|through)( the)? wardrobe',
        reuseInteractionId: 'wardrobe_open_key',
      },
      {
        regex: 'rummage (in|through)( the)? wardrobe',
        reuseInteractionId: 'wardrobe_open_empty',
      },
      {
        regex: 'rummage (in|through)( the)? wardrobe',
        reuseInteractionId: 'wardrobe_open_redundant',
      },
    ]
  },
  'rug': {
    id: 'rug',
    name: 'Rug',
    initialState: 'flat',
    /** Laid flat vs lifted, and whether the quarter is still under there. */
    initialAxes: { lay: 'flat', contents: 'quarter' },
    legacyStateKey: 'lay',
    descriptions: {
      'contents:quarter|lay:flat':
        "A faded blue rug with a space shuttle pattern. It's slightly bunched up near the corner—like something small might be tucked underneath.",
      'contents:quarter|lay:flipped':
        "The rug is still rumpled where you lifted it. The quarter is gone, but you could smooth it down if you want it tidy.",
      'contents:empty|lay:flat':
        "A faded blue rug with a space shuttle pattern. It lies flat on the floor; you've already taken the only thing that was hiding under it.",
      'contents:empty|lay:flipped':
        "The rug is flipped over where you lifted it. Nothing's left under there but dust and a faint outline where a coin used to sit.",
    },
    interactions: [
      {
        regex: 'look( at)?( the)? rug',
        reuseInteractionId: 'examine',
      },
      {
        id: 'rug_under_quarter',
        regex: '(look|search|flip|lift)( under)?( the)? rug',
        whenAxes: { contents: 'quarter' },
        text: "You lift the corner of the rug. Along with a few dust bunnies you find a QUARTER. Don't spend it all in one place.",
        setAxes: { lay: 'flipped', contents: 'empty' },
        getItem: 'quarter',
      },
      {
        id: 'rug_under_empty',
        regex: '(look|search|flip|lift)( under)?( the)? rug',
        whenAxes: { contents: 'empty' },
        setAxes: { contents: 'empty' },
        redundantMessage: "You've already checked under the rug. There's nothing new.",
      },
      {
        regex: 'peek (under|beneath)( the)? rug',
        reuseInteractionId: 'rug_under_quarter',
      },
      {
        regex: 'peek (under|beneath)( the)? rug',
        reuseInteractionId: 'rug_under_empty',
      },
      {
        id: 'rug_fix',
        regex: 'fix( the)? rug',
        whenAxes: { lay: 'flipped' },
        text: "You returned the rug to its original position. It's now flat.",
        setAxes: { lay: 'flat' },
        scoreDelta: 5,
      },
      {
        id: 'rug_fix_redundant',
        regex: 'fix( the)? rug',
        whenAxes: { lay: 'flat' },
        setAxes: { lay: 'flat' },
        redundantMessage: "The rug doesn't need to be fixed. So nice and tidy!",
      },
    ],
  },
  'window': {
    id: 'window',
    name: 'Window',
    initialState: 'default',
    descriptions: {
      'default': "A window looking outside the room."
    },
    interactions: [
      {
        regex: 'look ?(at|out|out of)?( the)? window',
        text: "You look out the window. The street below looks familiar, but the perspective is all wrong. You're much higher up than you remember being.",
        scoreDelta: 5,
      }
    ]
  },
  'door': {
    id: 'door',
    name: 'Door',
    initialState: 'locked',
    descriptions: {
      'locked': "A sturdy wooden door. It's locked from the outside. Don't ask how you somehow got locked in your own room. That's just how the story starts...",
      'unlocked': "The door is now unlocked."
    },
    interactions: [
      {
        regex: '(use|insert)( the)? (old key|old_key|key) (on|in|with)( the)? door',
        text: "You unlock the door and step out into the hallway. You feel chill bumps all over since you are barely clothed.",
        nextScene: 'hallway',
        removeItem: 'old_key',
        setState: 'unlocked',
        redundantMessage: 'The door is already unlocked.',
        missingRequirementsMessage: "You don't have a key to use on the door.",
      },
      {
        regex: '(go|walk|head)( through)?( the)? door',
        whenObjectState: 'unlocked',
        text: 'You slip through the doorway into the upstairs hall.',
        nextScene: 'hallway',
      },
      {
        regex: '(open|exit|leave|unlock)( through)?( the)? door',
        whenObjectState: 'unlocked',
        text: 'You ease the door open and step back into the upstairs hall.',
        nextScene: 'hallway',
      },
      {
        regex: '(open|unlock)( the)? door',
        whenObjectState: 'locked',
        requiresInventory: ['old_key'],
        text: "How do you propose to open the door? Perhaps you'd like to use the key?",
        setPrompt: {
          id: 'open_bedroom_door',
          aliases: {
            // Canonical must match unlock regex (`old_key` is item id; players say "old key" or "key").
            'use key': 'use key on door',
            'use key on door': 'use key on door',
            'use the key': 'use key on door',
            'use the key on door': 'use key on door',
            'use old key': 'use key on door',
            'use old key on door': 'use key on door',
            key: 'use key on door',
            'insert key': 'use key on door',
            'insert the key': 'use key on door',
            'insert key in door': 'use key on door',
          },
        },
        missingRequirementsMessage: "You have no way to open the locked door.",
        redundantMessage: "The door is already unlocked.",
      },
    ],
  },
  'bed': {
    id: 'bed',
    name: 'Bed',
    initialState: 'unmade',
    descriptions: {
      'unmade': "A twin-sized bunk bed with a pillow and a blanket. It's unmade since you just woke up.",
      'made': "The bed is now made. Your mom would be proud."
    },
    interactions: [
      {
        regex: '(make|tidy up) bed',
        text: "You make the bed. It's now made. Well done!",
        setState: 'made',
        redundantMessage: 'The bed is already made.',
        autoComplete: false,
        scoreDelta: 10,
      },
      {
        regex: '((get( back)?|lay|lie) in|go back|lie down on)( ?to)? bed',
        text: "You try to curl up in the tiny bed, but you've outgrown this life. You need to move forward.",
        setState: 'unmade'
      },
      {
        regex: 'jump (on(to)?)( the)? bed',
        text: "You attempt to jump on the bed. You are too tall and you hit your head on the ceiling. You land awkwardly on your ankle and fall too the floor. Unfortunately, your neck breaks your fall and you are dead.",
        isDeath: true,
        playSound: ['bone_break', 'death_rattle'],
      },
      {
        regex: 'look under( the)? bed',
        text: "You reluctantly look under the bed. Thankfully there are no monsters under there.",
        scoreDelta: 5,
      }
    ]
  },
  'gadget': {
    id: 'gadget',
    name: 'Gadget',
    initialState: 'on_table',
    descriptions: {
      'on_table': "A strange electronic device lies on the table.",
      'taken': "The table is empty where the gadget once was."
    },
    interactions: [
      {
        id: 'gadget_look',
        regex: 'look( at)?( the)? gadget',
        text: "It's a prototype for a digital comic book. It looks like something you'd design.",
      },
      {
        regex: 'inspect( the)? gadget',
        reuseInteractionId: REUSE_INTERACTION_EXAMINE,
      },
      {
        regex: '(take|get|pick up) gadget',
        text: "You pick up the digital comic prototype.",
        getItem: 'comic_book',
        setState: 'taken',
        redundantMessage: 'You already took the gadget.',
      }
    ]
  },
  'zoltar': {
    id: 'zoltar',
    name: 'Zoltar Machine',
    initialState: 'idle',
    descriptions: {
      'idle': "The fortune teller machine stands silent, its eyes dark.",
      'active': "Zoltar's eyes glow with a mystical light."
    },
    interactions: [
      {
        id: 'zoltar_look',
        regex: 'look( at)?( the)? (machine|zoltar)',
        text: "It's the Zoltar machine from the wish that started all of this. A coin slot waits in the shadows like a tiny mouth.",
      },
      {
        regex: 'inspect( the)? (machine|zoltar)',
        reuseInteractionId: 'examine',
      },
      {
        id: 'zoltar_use_quarter',
        regex: '(use|insert|put) quarter (with|in|into|on)?( the)? (machine|zoltar)',
        requiresInventory: ['quarter'],
        removeItem: 'quarter',
        text: "You slide the quarter into the slot. The machine wakes with a mechanical inhale—gears, lights, destiny. The world tears open like a cheap arcade curtain, and you are pulled into the game you saw on the screen so long ago.",
        setState: 'active',
        nextScene: 'cutscene_into_movie_game',
        redundantMessage: "The machine has already taken your quarter—and your reality with it.",
        missingRequirementsMessage: "You don't have a quarter to feed Zoltar.",
        scoreDelta: 50,
      },
      {
        id: 'zoltar_bang_has_quarter',
        regex: '(hit|bang|punch|kick)( the)? (machine|zoltar)',
        requiresInventory: ['quarter'],
        text: "You have a quarter right there in your pocket. Maybe don't antagonize the mystical vending machine of fate?",
      },
      {
        id: 'zoltar_bang_no_quarter',
        regex: '(hit|bang|punch|kick)( the)? (machine|zoltar)',
        text: "You hammer on the machine in frustration. Distant sirens answer. Flashlights. Shouted commands. In the confusion, you go down hard—and you don't get back up.",
        isDeath: true,
      },
    ],
  },
  'parents_closet': {
    id: 'parents_closet',
    name: 'Closet',
    initialState: 'closed',
    initialAxes: { door: 'closed', contents: 'full' },
    legacyStateKey: 'door',
    descriptions: {
      'contents:full|door:closed': "Your parents' closet—Giants gear, folded laundry, and the faint smell of fabric softener and regret.",
      'contents:full|door:open': 'The closet stands open: a blue Giants hoodie, gray sweatpants, and a pair of white sneakers wait like a costume for a normal person.',
      'contents:empty|door:open': "You've already taken the useful clothes. The rest is just adult life in textile form.",
    },
    interactions: [
      {
        regex: '(open|search)( the)? closet',
        whenAxes: { door: 'closed', contents: 'full' },
        text: 'You ease the closet open. Giants hoodie, gray sweatpants, white sneakers—borrowed dignity.',
        setAxes: { door: 'open' },
        playSound: 'wood_creak_open',
      },
      {
        regex: '(take|get|grab) (the )?(clothes|outfit|hoodie|sneakers|sweatpants)( from closet)?',
        whenAxes: { door: 'open', contents: 'full' },
        text: "You grab the hoodie, sweatpants, and sneakers. It's not your style—it's better. It's survival.",
        setAxes: { contents: 'empty' },
        scoreDelta: 15,
        callback: (s) => ({
          ...s,
          inventory: [...new Set([...s.inventory, 'giants_hoodie', 'sweatpants_gray', 'sneakers_white'])],
        }),
      },
      {
        regex: 'close( the)? closet',
        whenAxes: { door: 'open' },
        text: 'You close the closet.',
        setAxes: { door: 'closed' },
        playSound: 'wood_creak_close',
      },
    ],
  },
  'rattle_table': {
    id: 'rattle_table',
    name: 'Nightstand',
    initialState: 'rattle_here',
    descriptions: {
      rattle_here: 'A nightstand with a baby RATTLE on top—your mom must have left it here for emergencies.',
      empty: 'The nightstand is bare except for a ring of dust where the rattle used to sit.',
    },
    interactions: [
      {
        regex: '(take|get|pick up) rattle',
        whenObjectState: 'rattle_here',
        text: 'You pocket the rattle. It feels ridiculous. It also feels like peace insurance.',
        getItem: 'rattle',
        setState: 'empty',
        scoreDelta: 5,
      },
    ],
  },
  'playpen': {
    id: 'playpen',
    name: 'Playpen',
    initialState: 'crying',
    initialAxes: { sister: 'crying' },
    legacyStateKey: 'sister',
    descriptions: {
      'sister:crying': 'Your baby sister is in the playpen—face scrunched, volume dialed to eleven.',
      'sister:quiet': 'Your sister is gnawing on the edge of a blanket, calm for now.',
      'sister:frenzy': 'Your sister is inconsolable—this time there is no toy, no trick, no mercy in her lungs.',
    },
    interactions: [
      {
        regex: 'examine( the)? playpen',
        reuseInteractionId: REUSE_INTERACTION_EXAMINE,
      },
      {
        regex: '(give|hand) rattle( to)?( the)?( baby)? sister',
        whenAxes: { sister: 'crying' },
        requiresInventory: ['rattle'],
        removeItem: 'rattle',
        text: 'You offer the rattle. Your sister grabs it mid-wail—then goes suspiciously quiet, like someone flipped a breaker.',
        setAxes: { sister: 'quiet' },
        scoreDelta: 25,
      },
      {
        regex: '(give|hand) rattle( to)?( the)?( baby)? sister',
        whenAxes: { sister: 'frenzy' },
        text: 'You try the rattle again. She bats it away. This is beyond rattles. This is a category-five meltdown.',
      },
    ],
  },
  'parents_exit_door': {
    id: 'parents_exit_door',
    name: 'Bedroom Door',
    initialState: 'default',
    descriptions: {
      default: "The door back to the hallway. Beyond it: decisions, danger, and your father's bathroom timing.",
    },
    interactions: [
      {
        regex: '(go|leave|exit|return)( to)?( the)? hallway',
        callback: (s) => {
          const pen = s.objectStates?.playpen;
          const sister =
            typeof pen === 'object' && pen && 'sister' in pen ? (pen as { sister: string }).sister : 'crying';
          const fatal = '[DEATH] YOU HAVE DIED.';
          if (sister === 'frenzy') {
            return {
              ...s,
              isGameOver: true,
              hp: 0,
              history: [
                ...s.history,
                'You try to slip out. Your father appears in the doorway—no towel diplomacy this time. He tackles you in pure parental adrenaline, and the world goes black in a chokehold of shame.',
                fatal,
              ],
            };
          }
          if (sister !== 'quiet') {
            return {
              ...s,
              isGameOver: true,
              hp: 0,
              history: [
                ...s.history,
                "You reach for the door. Behind you, your sister hits a note only dogs should hear. Your father steps out of the bathroom with a towel around his waist, sees you, and throws a punch that rearranges your face—and your future.",
                fatal,
              ],
            };
          }
          const firstLeave = !s.flags.parents_left_success_once;
          const nextFlags = firstLeave
            ? { ...s.flags, parents_left_success_once: true, house_arc_need_hurry: true }
            : { ...s.flags };
          const preamble = firstLeave
            ? "You ease back into the hallway. Downstairs, you can hear your mom moving around the kitchen. Upstairs, the bathroom door is still shut—but not for long.\n\nYou'd better move."
            : undefined;
          return simpleSceneEntry({ ...s, flags: nextFlags }, 'hallway', preamble, 'parents_bedroom');
        },
      },
    ],
  },
  'bathroom_door': {
    id: 'bathroom_door',
    name: 'Bathroom Door',
    initialState: 'locked',
    descriptions: {
      locked: "The bathroom door is locked. From inside: the unmistakable sound of your dad clearing his throat like he's hosting a morning radio show.",
    },
    interactions: [
      {
        regex: '(knock|listen)( on|at)?( the)? bathroom',
        text: "You knock once. Your dad grumbles something unintelligible. Best not to push it.",
      },
      {
        regex: '(open|enter)( the)? bathroom',
        text: "Locked. And honestly? You're not emotionally prepared for whatever is happening in there.",
      },
    ],
  },
  'evil_wizard': {
    id: 'evil_wizard',
    name: 'Evil Wizard',
    initialState: 'threatening',
    descriptions: {
      threatening:
        'The Evil Wizard hovers above the ice, scepter raised. His voice booms like a bad speaker system: "YOU DARE CHALLENGE ME?"',
    },
    interactions: [
      {
        regex: 'look( at)?( the)? wizard',
        text: 'He is all beard, ice, and theatrical menace. The scepter tip sparkles like a cruel star.',
      },
      {
        regex: '(melt|thaw) wizard',
        text: 'WHAT DO YOU WANT TO MELT HIM WITH ?',
        setPrompt: {
          id: 'melt_wizard_tool',
          aliases: {
            'thermal pod': 'use thermal pod on wizard',
            'use thermal pod': 'use thermal pod on wizard',
            'use thermal pod on wizard': 'use thermal pod on wizard',
            'throw pod': 'use thermal pod on wizard',
            'throw thermal pod': 'use thermal pod on wizard',
            pod: 'use thermal pod on wizard',
            'use pod': 'use thermal pod on wizard',
          },
        },
        setDeadline: {
          deadlineMsFromNow: 40_000,
          deadlineTurnsLeft: 12,
          deadlineSceneId: 'ice_wizard_arena',
          deadlineReason: 'wizard_melt',
        },
        scoreDelta: 5,
      },
      {
        regex: 'use thermal pod on wizard',
        callback: (s) => {
          if (!s.inventory.includes('thermal_pod')) {
            return {
              ...s,
              history: [
                ...s.history,
                "You mime a heroic throw—but you don't have a THERMAL POD. The wizard's smile widens. This was a test. You failed it loudly.",
              ],
            };
          }
          let next: GameState = {
            ...s,
            inventory: s.inventory.filter((id) => id !== 'thermal_pod'),
            pendingPrompt: undefined,
            deadlineAtMs: undefined,
            deadlineSceneId: undefined,
            deadlineReason: undefined,
            deadlineTurnsLeft: undefined,
            focusedObjectId: 'evil_wizard',
            score: (s.score ?? 0) + 200,
            history: [
              ...s.history,
              'You hurl the thermal pod. Reality warps into steam, screaming, and the smell of melting plot armor. The wizard shrieks as the ice around him flash-boils into legend.',
            ],
          };
          audioService.playSound('achievement');
          if (!next.inventory.includes('ice_relic')) {
            next.inventory = [...next.inventory, 'ice_relic'];
            next.pendingItem = 'ice_relic';
            next.uiVisible = true;
          }
          return simpleSceneEntry(next, 'relic_escape');
        },
      },
    ],
  },
};

function bedroomDoorUnlocked(s: GameState): boolean {
  const raw = s.objectStates.door;
  if (raw === undefined) return false;
  if (typeof raw === 'string') return raw === 'unlocked';
  return (raw as Record<string, string>).s === 'unlocked';
}

export const SCENES: Record<string, Scene> = {
  'bedroom': {
    id: 'bedroom',
    viewportHandoffLayoutId: 'viewport-scene-panel',
    title: "{{name}}'s Bedroom",
    description:
      "You're in your childhood bedroom—ceiling too low, bunk too short, 80s posters watching you like old friends. Your dinosaur pajamas strain at the seams. A WARDROBE, shuttle-pattern RUG, WINDOW, and DOOR are the obvious landmarks.",
    examineRefreshText:
      "Looking around the room, you see the bunk BED, posters on the walls, the WARDROBE, RUG, WINDOW, and DOOR. When it's unlocked, that door is your way back to the upstairs HALL—try OPEN DOOR, GO HALL, or LEAVE ROOM once you're ready to step out.",
    onLoad: {
      text: "You wake up in a room that feels impossibly small. You sit up from the top bunk of a twin-sized bunk BED, but your legs are hanging off the end. Your head nearly brushes the ceiling.\n\nAs you look around, posters of 80s movies line the walls. You're wearing your favorite dinosaur pajamas, but they're stretched to their limit across your adult frame. There's a WARDROBE, a RUG, a WINDOW, and a DOOR.",
    },
    image: "/assets/images/bedroom.png",
    isCheckpoint: true,
    objects: ['bed', 'wardrobe', 'rug', 'window', 'door'],
    interactionLabels: ['BED', 'WARDROBE', 'RUG', 'WINDOW', 'DOOR'],
    exits: {
      hallway: 'hallway',
      hall: 'hallway',
      out: 'hallway',
      outside: 'hallway',
      'through door': 'hallway',
      'through the door': 'hallway',
    },
    commands: {
      '(leave|exit)( the)? room': {
        callback: (s) => {
          if (!bedroomDoorUnlocked(s)) {
            return {
              ...s,
              history: [
                ...s.history,
                "The hall door is locked from the outside—whoever designed this house clearly didn't trust kid-you with freedom.",
              ],
            };
          }
          return simpleSceneEntry(
            s,
            'hallway',
            'You step out into the upstairs hall. The house still sounds asleep—deceptively calm.',
            'bedroom',
          );
        },
      },
    },
  },
  'hallway': {
    id: 'hallway',
    title: 'The Narrow Hallway',
    description:
      "You're in the upstairs hall of your parents' house—low ceiling, family photos, that one creaky board. NORTH: the stairs down. SOUTH: your parents' bedroom door. EAST: the bathroom. WEST: your bedroom.",
    examineRefreshText:
      'The hall is quiet except for the ordinary sounds of a house waking up—somewhere downstairs, a cabinet closes. Upstairs, the bathroom fan hums like a warning.',
    objects: ['bathroom_door'],
    exits: {
      west: 'bedroom',
      south: 'parents_bedroom',
    },
    interactionLabels: ['STAIRS', 'PARENTS_ROOM', 'BATHROOM', 'YOUR_ROOM'],
    commands: {
      '(go|walk|head) (north|downstairs)': {
        callback: (s) => {
          const dressed = ['giants_hoodie', 'sweatpants_gray', 'sneakers_white'].every((id) =>
            (s.equippedItemIds ?? []).includes(id),
          );
          if (!dressed) {
            if (!s.flags.hallway_downstairs_warned) {
              return {
                ...s,
                flags: { ...s.flags, hallway_downstairs_warned: true },
                history: [
                  ...s.history,
                  'You might startle whoever is down there in your current condition.',
                ],
              };
            }
            return {
              ...s,
              isGameOver: true,
              hp: 0,
              history: [
                ...s.history,
                "You go downstairs anyway. Your mother turns from the sink—and freezes. She doesn't recognize the half-dressed grown man in her kitchen. She screams. Police arrive fast. In the chaos of flashlights and shouted commands, something goes terribly wrong. This is New Jersey. It wasn't pretty.",
                '[DEATH] YOU HAVE DIED.',
              ],
            };
          }
          return simpleSceneEntry(
            {
              ...s,
              flags: { ...s.flags, urgent_hallway: false, house_arc_need_hurry: false },
              deadlineAtMs: undefined,
              deadlineSceneId: undefined,
              deadlineReason: undefined,
              deadlineTurnsLeft: undefined,
            },
            'cutscene_house_escape',
            'You slip downstairs on quiet feet, dressed like a person who belongs in this decade. The kitchen light spills across the linoleum. Your mom hums to herself, distracted. You ghost past the doorway, out the side door, and into the night.',
            'hallway',
          );
        },
      },
      '(go|walk|head) south': {
        text: "You ease open your parents' bedroom door and slip inside.",
        nextScene: 'parents_bedroom',
      },
      '(go|walk|head) east': {
        text: "You step up to the bathroom door.",
        nextScene: 'bathroom_hall',
      },
      '(go|walk|head) west': {
        text: 'You duck back into your bedroom.',
        nextScene: 'bedroom',
      },
      'look( at)?( the)? photos': {
        text: 'The photos show you and your parents at various ages. You look so small in them—like proof you were ever little.',
        scoreDelta: 3,
      },
    },
  },
  'bathroom_hall': {
    id: 'bathroom_hall',
    title: 'Outside the Bathroom',
    description:
      "You're at the bathroom door. It's locked. From inside comes the unmistakable sound of your dad clearing his throat like he's hosting a morning radio show.",
    objects: ['bathroom_door'],
    exits: { back: 'hallway' },
    commands: {
      '(go|walk|head) back': {
        text: 'You step away from the bathroom and return to the hall.',
        nextScene: 'hallway',
      },
    },
  },
  'parents_bedroom': {
    id: 'parents_bedroom',
    title: "Parents' Bedroom",
    description:
      "The room is dim. Your baby sister is in a PLAYPEN by the wall. A CLOSET looms like a wardrobe of adult consequences. A NIGHTSTAND holds a rattle. The door back to the HALLWAY is behind you.",
    examineRefreshText:
      'The playpen, the closet, the nightstand, the door—everything feels louder than it should. Your sister watches you with the moral certainty of a judge.',
    objects: ['parents_closet', 'rattle_table', 'playpen', 'parents_exit_door'],
    interactionLabels: ['CLOSET', 'PLAYPEN', 'NIGHTSTAND', 'DOOR'],
    exits: {},
    commands: {},
  },
  'cutscene_house_escape': {
    id: 'cutscene_house_escape',
    viewportHandoffLayoutId: 'viewport-scene-panel',
    title: 'Into the Night',
    description:
      'The suburban night air hits you like a reboot. Streetlights. Crickets. Somewhere, a dog barks at the universe.',
    background: '/assets/images/bedroom.png',
    objects: [],
    exits: {},
    commands: {
      'continue': {
        text: 'You grab your bike from the side of the house and kick off into the dark.',
        nextScene: 'cutscene_bike_to_fairgrounds',
      },
    },
  },
  'cutscene_bike_to_fairgrounds': {
    id: 'cutscene_bike_to_fairgrounds',
    viewportHandoffLayoutId: 'viewport-scene-panel',
    title: 'Sea Point Park',
    description:
      'You pedal until your lungs burn. The carnival lights you remember are gone—only empty chain-link and wind-torn banners remain.',
    background: '/assets/images/bedroom.png',
    objects: [],
    exits: {},
    commands: {
      'continue': {
        text: 'At the center of the desolation, one machine remains: Zoltar, waiting like a punchline.',
        nextScene: 'zoltar_fairgrounds',
      },
    },
  },
  'zoltar_fairgrounds': {
    id: 'zoltar_fairgrounds',
    viewportHandoffLayoutId: 'viewport-scene-panel',
    title: 'The Last Arcade',
    description:
      'The fairgrounds are empty. One arcade cabinet stands alone in the moonlight—ZOLTAR, grinning with painted eyes.',
    image: 'https://picsum.photos/seed/zoltar-night/800/600',
    isCheckpoint: true,
    objects: ['zoltar'],
    exits: {},
    commands: {},
  },
  'cutscene_into_movie_game': {
    id: 'cutscene_into_movie_game',
    viewportHandoffLayoutId: 'viewport-scene-panel',
    title: 'CAVERN OF THE EVIL WIZARD',
    description:
      'The screen glare becomes snow. The synth music becomes wind. You are not at the fairgrounds anymore—you are inside the game, pixel borders gone, stakes horribly real.',
    background: '/assets/images/bedroom.png',
    objects: [],
    exits: {},
    commands: {
      'continue': {
        text: 'When the whiteout fades, you smell woodsmoke and ice.',
        nextScene: 'ice_dwarf_village',
      },
    },
  },
  'ice_dwarf_village': {
    id: 'ice_dwarf_village',
    viewportHandoffLayoutId: 'viewport-scene-panel',
    title: 'Ice Dwarf Village',
    description:
      'Snow huts ring a blue fire. Ice Dwarves in patchwork mail size you up like a math problem. Their chief taps a training sword against her palm.',
    image: 'https://picsum.photos/seed/ice-village/800/600',
    isCheckpoint: true,
    objects: [],
    exits: { north: 'icy_pass' },
    commands: {
      '(talk|speak)( to)?( the)?( chief|dwarves)?': {
        text: '"The Evil Wizard stole our relic ages ago," the chief says. "Train. Take a blade. Then freeze—or fight."',
        scoreDelta: 10,
      },
      train: {
        text: 'You drill forms until your breath ghosts in the air. The dwarves nod—barely impressed, but not disappointed.',
        scoreDelta: 15,
      },
      '(take|accept) sword': {
        callback: (s) => {
          if (s.inventory.includes('training_sword')) {
            return { ...s, history: [...s.history, 'You already have a training sword. The chief is not handing out seconds.'] };
          }
          audioService.playSound('achievement');
          return {
            ...s,
            inventory: [...s.inventory, 'training_sword'],
            pendingItem: 'training_sword',
            uiVisible: true,
            history: [...s.history, 'The chief slaps a notched training sword into your hands. "Try not to embarrass us."'],
            score: (s.score ?? 0) + 20,
          };
        },
      },
    },
  },
  'icy_pass': {
    id: 'icy_pass',
    title: 'Icy Pass',
    description:
      'Wind scrapes the pass like teeth. Somewhere ahead, a supply cache glimmers—armor meant for the cavern gate.',
    image: 'https://picsum.photos/seed/icy-pass/800/600',
    objects: [],
    exits: { south: 'ice_dwarf_village', north: 'glacial_armory' },
    commands: {
      '(go|walk|head) south': { text: 'You trek back toward the village.', nextScene: 'ice_dwarf_village' },
      '(go|walk|head) north': { text: 'You push onward into the gale.', nextScene: 'glacial_armory' },
    },
  },
  'glacial_armory': {
    id: 'glacial_armory',
    title: 'Glacial Armory',
    description:
      'Crates of furs and ice-threaded mail line the walls. A placard reads: NOT FOR TOURISTS.',
    image: 'https://picsum.photos/seed/glacial-armory/800/600',
    objects: [],
    exits: { south: 'icy_pass', north: 'ice_cavern_gate' },
    commands: {
      '(take|get|wear) armor': {
        callback: (s) => {
          if (s.inventory.includes('glacial_armor')) {
            return { ...s, history: [...s.history, "You've already suited up. Any more furs and you'd be a yeti."] };
          }
          audioService.playSound('achievement');
          return {
            ...s,
            inventory: [...s.inventory, 'glacial_armor'],
            pendingItem: 'glacial_armor',
            uiVisible: true,
            history: [...s.history, 'You wrestle into the glacial armor until your teeth stop chattering quite so loudly.'],
            score: (s.score ?? 0) + 40,
          };
        },
      },
      '(go|walk|head) south': { text: 'You march back to the pass.', nextScene: 'icy_pass' },
      '(go|walk|head) north': { text: 'The cavern gate looms ahead.', nextScene: 'ice_cavern_gate' },
    },
  },
  'ice_cavern_gate': {
    id: 'ice_cavern_gate',
    title: 'Ice Cavern Gate',
    description:
      'A mouth of black ice waits. The cold hits like a wall. Without proper protection, you would freeze solid in seconds.',
    image: 'https://picsum.photos/seed/ice-gate/800/600',
    objects: [],
    exits: { south: 'glacial_armory' },
    commands: {
      '(go|walk|head) south': { text: 'You retreat toward the armory.', nextScene: 'glacial_armory' },
      '(enter|go in|go into) cavern': {
        callback: (s) => {
          if (!(s.equippedItemIds ?? []).includes('glacial_armor')) {
            return {
              ...s,
              isGameOver: true,
              hp: 0,
              history: [
                ...s.history,
                'You take one step inside. The cold seizes your lungs. Your muscles lock. You become a very sincere ice sculpture.',
                '[DEATH] YOU HAVE DIED.',
              ],
            };
          }
          return simpleSceneEntry(s, 'ice_wizard_arena', 'The cavern swallows you whole.', 'ice_cavern_gate');
        },
      },
    },
  },
  'ice_wizard_arena': {
    id: 'ice_wizard_arena',
    title: 'Throne of Frost',
    description:
      'The Evil Wizard drifts above a spiral of shattered statues—Ice Dwarves who came before you. Your thermal pod is heavy at your belt.',
    image: 'https://picsum.photos/seed/wizard-arena/800/600',
    isCheckpoint: true,
    objects: ['evil_wizard'],
    exits: {},
    commands: {},
    onLoad: {
      text: 'A THERMAL POD hums on a dais—military surplus from whatever mad god runs this arcade universe. You pocket it. The wizard notices.',
      getItem: 'thermal_pod',
    },
  },
  'relic_escape': {
    id: 'relic_escape',
    title: 'The Relic Road',
    description:
      'The relic thrums in your pack like a heartbeat everyone can hear. Footsteps crunch behind you—too many, too fast.',
    image: 'https://picsum.photos/seed/relic-escape/800/600',
    objects: [],
    exits: {},
    commands: {
      '(run|flee|sprint)': {
        text: 'You run until your armor rings like a bell. The pursuit tightens.',
        nextScene: 'bandit_pass',
        scoreDelta: 10,
      },
    },
  },
  'bandit_pass': {
    id: 'bandit_pass',
    title: 'Ambush at Blackfrost Bridge',
    description:
      'Masked figures block the bridge. One points at your pack. "Relic. Hand it over—or we take your fingers as interest."',
    image: 'https://picsum.photos/seed/ambush-bridge/800/600',
    objects: [],
    exits: {},
    commands: {
      '(fight|attack|draw) sword': {
        text: 'You rip the training sword free and swing like your life depends on it—because it does. The bandits scatter, cursing in three dialects of coward.',
        requiresInventory: ['training_sword'],
        nextScene: 'ice_dwarf_village_final',
        scoreDelta: 50,
        missingRequirementsMessage: "You don't have a blade to back that bravery up.",
      },
      '(talk|negotiate|bluff)': {
        text: 'You stall with nonsense about taxes until the Ice Dwarven patrol horns answer from the ridge. The bandits bolt.',
        nextScene: 'ice_dwarf_village_final',
        scoreDelta: 35,
      },
    },
  },
  'ice_dwarf_village_final': {
    id: 'ice_dwarf_village_final',
    title: 'Homecoming',
    description:
      'The village cheers—quietly, like people who have learned not to tempt fate. The chief accepts the relic with both hands, eyes wet.',
    image: 'https://picsum.photos/seed/ice-village-return/800/600',
    isCheckpoint: true,
    objects: [],
    exits: {},
    commands: {
      '(give|hand|return) relic': {
        text: 'You place the thawed relic in the chief\'s hands. The air itself seems to exhale. Balance returns—cold, sharp, and honest.',
        removeItem: 'ice_relic',
        nextScene: 'ending_fair_return',
        scoreDelta: 500,
        missingRequirementsMessage: "You don't have the relic to return.",
      },
    },
  },
  'ending_fair_return': {
    id: 'ending_fair_return',
    title: 'The Wish, Again',
    description:
      "Light smears across your vision—arcade bulbs, cotton candy, your parents' worried-laugh faces. The fair is loud and alive. You're thirteen again, or close enough. The relic is gone. The dwarves are safe. And somewhere, Zoltar waits for the next fool with a quarter.",
    background: '/assets/images/bedroom.png',
    objects: [],
    exits: {},
    commands: {},
  },
  'cutscene_intro': {
    id: 'cutscene_intro',
    viewportHandoffLayoutId: 'viewport-scene-panel',
    title: 'A Strange Awakening',
    description: "You awake in a familiar room, however, something feels .... different. The ceiling seems closer, the bed feels smaller, and your perspective has shifted. You feel bigger, stronger, yet strangely out of place in your own childhood sanctuary.",
    background: "/assets/images/bedroom.png",
    objects: [],
    exits: {},
    commands: {
      'explore the room': {
        nextScene: 'bedroom'
      }
    }
  }
};

/**
 * Minimal scene transition for `callback`-driven moves (avoids importing the engine into data).
 * Does not run checkpoint persistence or onLoad SFX.
 */
function simpleSceneEntry(
  state: GameState,
  sceneId: string,
  preamble?: string,
  fromSceneId?: string,
): GameState {
  const scene = SCENES[sceneId];
  if (!scene) return { ...state, currentSceneId: sceneId };
  const key = `__sceneOnLoad__:${sceneId}`;
  const onLoad = scene.onLoad;
  const first = Boolean(onLoad && !state.flags[key]);
  let flags = { ...state.flags };
  let inventory = [...state.inventory];
  let uiVisible = state.uiVisible;
  let pendingItem = state.pendingItem;
  let hasMap = state.hasMap;
  let score = state.score ?? 0;
  let implicitScore = 0;
  const rn = (t: string) => t.replace(/{{name}}/g, state.playerName);
  const parts: string[] = [];
  if (preamble) parts.push(rn(preamble));
  if (first && onLoad) {
    flags[key] = true;
    if (onLoad.text) parts.push(rn(onLoad.text));
    if (onLoad.sound) audioService.playSound(onLoad.sound);
    if (onLoad.getItem && !inventory.includes(onLoad.getItem)) {
      inventory = [...inventory, onLoad.getItem];
      uiVisible = true;
      pendingItem = onLoad.getItem;
      if (onLoad.getItem === 'map') hasMap = true;
      implicitScore += SCORE_PICKUP_ITEM;
    }
    if (onLoad.removeItem && inventory.includes(onLoad.removeItem)) {
      inventory = inventory.filter((id) => id !== onLoad.removeItem);
    }
    if (onLoad.setFlags) {
      flags = { ...flags, ...onLoad.setFlags };
    }
  } else if (scene.description) {
    parts.push(rn(scene.description));
  }

  const progressKey = `__sceneProgressScore__:${sceneId}`;
  if (fromSceneId && fromSceneId !== sceneId && !flags[progressKey]) {
    flags = { ...flags, [progressKey]: true };
    implicitScore += SCORE_FIRST_ENTER_SCENE;
  }

  if (implicitScore > 0) {
    score += implicitScore;
  }

  return {
    ...state,
    currentSceneId: sceneId,
    flags,
    inventory,
    uiVisible,
    pendingItem,
    hasMap,
    score,
    history: parts.length ? [...state.history, parts.join('\n\n')] : state.history,
  };
}

export const INITIAL_STATE: GameState = {
  playerName: 'Josh',
  currentSceneId: 'bedroom',
  inventory: [],
  objectStates: {},
  hp: 100,
  maxHp: 100,
  flags: {},
  history: [],
  isGameOver: false,
  gameStarted: false,
  namingPhase: false,
  uiVisible: false,
  hasMap: false,
  pendingItem: null,
  focusedObjectId: undefined,
  equippedItemIds: [],
  score: 0,
};

/**
 * Scene transition hook (called from `applySceneArrival` after one-shot onLoad / description).
 * Used for hallway urgency timers and second-visit parents bedroom state.
 */
export function runSceneEnterHook(state: GameState, sceneId: string, fromSceneId?: string): GameState {
  let s = { ...state };

  if (sceneId === 'hallway' && fromSceneId === 'bedroom' && s.flags.urgent_hallway) {
    return {
      ...s,
      deadlineAtMs: Date.now() + 45_000,
      deadlineTurnsLeft: 15,
      deadlineSceneId: 'hallway',
      deadlineReason: 'hallway_hurry',
    };
  }

  if (sceneId === 'hallway' && fromSceneId === 'parents_bedroom' && s.flags.house_arc_need_hurry) {
    return {
      ...s,
      flags: { ...s.flags, urgent_hallway: true, house_arc_need_hurry: false },
      deadlineAtMs: Date.now() + 45_000,
      deadlineTurnsLeft: 15,
      deadlineSceneId: 'hallway',
      deadlineReason: 'hallway_hurry',
    };
  }

  if (sceneId === 'parents_bedroom' && fromSceneId === 'hallway' && s.flags.urgent_hallway) {
    return {
      ...s,
      objectStates: {
        ...s.objectStates,
        playpen: { sister: 'frenzy' },
      },
    };
  }

  return s;
}
