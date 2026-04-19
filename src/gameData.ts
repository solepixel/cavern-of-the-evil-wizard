import { GameState, Item, Scene, GameObject, INITIAL_STATE as BASE_INITIAL_STATE } from './types';

export const ITEMS: Record<string, Item> = {
  'old_key': {
    id: 'old_key',
    name: 'Old Brass Key',
    description: 'A heavy, tarnished key found in your childhood wardrobe.',
    useText: 'You insert the key into the lock. It turns with a satisfying click.',
    icon: 'Key'
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
  'warm_clothes': {
    id: 'warm_clothes',
    name: 'Adult-Sized Hoodie',
    description: 'A red hoodie that actually fits your grown-up body.',
    useText: 'You put on the hoodie. You feel much less ridiculous now.',
    icon: 'Shirt'
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
    icon: 'Map'
  }
};

export const OBJECTS: Record<string, GameObject> = {
  'wardrobe': {
    id: 'wardrobe',
    name: 'Wardrobe',
    initialState: 'closed',
    descriptions: {
      'closed': "It's a heavy oak wardrobe. It looks like it might contain something useful.",
      'open': "It's an opened wardrobe. It once held your childhood clothes, but now it's mostly empty except for some dust."
    },
    interactions: [
      {
        regex: 'look( at)?( the)? wardrobe',
        text: "It's a heavy oak wardrobe. It looks like it might contain something useful."
      },
      {
        regex: '(open( up)?|search|look in(side)?)( the)? wardrobe',
        text: "You open the wardrobe. Inside, you find a red hoodie that looks like it might fit you, and an OLD BRASS KEY hanging on a hook.",
        getItem: 'old_key',
        setState: 'open',
        redundantMessage: 'The wardrobe is already open.',
      }
    ]
  },
  'rug': {
    id: 'rug',
    name: 'Rug',
    initialState: 'flat',
    descriptions: {
      'flat': "A faded blue rug with a space shuttle pattern. It's slightly bunched up near the corner.",
      'flipped': "The rug is flipped over where you lifted it."
    },
    interactions: [
      {
        regex: 'look( at)?( the)? rug',
        text: "A faded blue rug with a space shuttle pattern. It's slightly bunched up near the corner."
      },
      {
        regex: '(look|search|flip|lift)( under)?( the)? rug',
        text: "You lift the corner of the rug. Just dust bunnies and a stray penny. Nothing useful.",
        setState: 'flipped',
        redundantMessage: "You've already checked under the rug. There's nothing new.",
      },
      {
        regex: 'fix( the)? rug',
        text: "You returned the rug to its original position. It's now flat.",
        setState: 'flat',
        redundantMessage: "The rug doesn't need to be fixed.",
      }
    ]
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
        text: "You look out the window. The street below looks familiar, but the perspective is all wrong. You're much higher up than you remember being."
      }
    ]
  },
  'door': {
    id: 'door',
    name: 'Door',
    initialState: 'locked',
    descriptions: {
      'locked': "A sturdy wooden door. It's locked from the inside.",
      'unlocked': "The door is now unlocked."
    },
    interactions: [
      {
        regex: '(open|unlock)( the)? door',
        text: "The door is locked. You'll need a key to get out."
      },
      {
        regex: '(use|insert) (old_key|key) (on|in|with) door',
        text: "You unlock the door and step out into the hallway.",
        nextScene: 'hallway',
        removeItem: 'old_key',
        setState: 'unlocked',
        redundantMessage: 'The door is already unlocked.',
      }
    ]
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
      },
      {
        regex: '(get( back)? in|go back|lie down on)( ?to)? bed',
        text: "You try to curl up in the tiny bed, but you've outgrown this life. You need to move forward.",
        setState: 'unmade'
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
        regex: 'look( at)?( the)? gadget',
        text: "It's a prototype for a digital comic book. It looks like something you'd design."
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
        regex: 'look( at)?( the)? machine',
        text: "It's a Zoltar machine. The eyes seem to glow with an inner light. There's a slot for a coin."
      },
      {
        regex: '(use|insert|put) (magic_coin|coin) (on|in) machine',
        text: "You insert the coin. Zoltar's eyes light up. 'I WISH I WERE BIG,' you whisper. A card slides out: 'YOUR WISH IS GRANTED. BUT BEWARE THE COST.'",
        getItem: 'mystic_pendant',
        setState: 'active',
        redundantMessage: "Zoltar's eyes are already glowing—you've used the machine.",
      }
    ]
  }
};

export const SCENES: Record<string, Scene> = {
  'bedroom': {
    id: 'bedroom',
    title: "{{name}}'s Bedroom",
    description:
      "You wake up in a room that feels impossibly small. You sit up from the top bunk of a twin-sized bunk BED, but your legs are hanging off the end. Your head nearly brushes the ceiling.\n\nAs you look around, posters of 80s movies line the walls. You're wearing your favorite dinosaur pajamas, but they're stretched to their limit across your adult frame. There's a WARDROBE, a RUG, a WINDOW, and a DOOR.",
    image: "/assets/images/bedroom.png",
    isCheckpoint: true,
    objects: ['bed', 'wardrobe', 'rug', 'window', 'door'],
    interactionLabels: ['BED', 'WARDROBE', 'RUG', 'WINDOW', 'DOOR'],
    exits: {},
    commands: {}
  },
  'hallway': {
    id: 'hallway',
    title: 'The Narrow Hallway',
    description: "The hallway is dimly lit. The ceiling feels low. To the north is the stairs leading down. To the south is your parents' room. You can hear the faint sound of a carnival in the distance.",
    objects: [],
    exits: {
      'north': 'living_room'
    },
    commands: {
      '(go|walk|head) north': {
        text: "You head down the stairs.",
        nextScene: 'living_room'
      },
      '(go|walk|head) south': {
        text: "The door to your parents' room is closed. You probably shouldn't wake them up in this state."
      },
      'look( at)?( the)? photos': {
        text: "The photos show you and your parents at various ages. You look so small in them."
      }
    }
  },
  'living_room': {
    id: 'living_room',
    title: 'Living Room',
    description: "The living room is filled with shadows. The TV is flickering with static. On the coffee table lies a GADGET and a MAP. The front door leads OUT.",
    image: "https://picsum.photos/seed/retro-living-room/800/600",
    isCheckpoint: true,
    objects: ['gadget'],
    exits: {
      'out': 'street'
    },
    commands: {
      '(take|get|pick up) map': {
        text: "You pick up the hand-drawn map of the neighborhood.",
        getItem: 'map'
      },
      '(go|step) out': {
        text: "You open the front door and step out into the night.",
        nextScene: 'street'
      }
    }
  },
  'street': {
    id: 'street',
    title: 'The Midnight Street',
    description: "The street is quiet. The air is cool. In the distance, you see the bright lights of a CARNIVAL. A path leads there.",
    image: "https://picsum.photos/seed/retro-street/800/600",
    objects: [],
    exits: {
      'carnival': 'carnival_entrance'
    },
    commands: {
      '(go|walk|head) (to|towards)? carnival': {
        text: "You walk towards the lights.",
        nextScene: 'carnival_entrance'
      }
    }
  },
  'carnival_entrance': {
    id: 'carnival_entrance',
    title: 'Carnival Entrance',
    description: "The carnival is vibrant and loud. Music blares from every direction. A large sign reads: 'SEA POINT PARK'. Ahead is the midway. To the side, a dark path leads to the 'CAVERN OF THE EVIL WIZARD' attraction.",
    image: "https://picsum.photos/seed/carnival-gate/800/600",
    isCheckpoint: true,
    objects: [],
    exits: {
      'midway': 'midway',
      'cavern': 'cavern_entrance'
    },
    commands: {
      '(go|walk|head) (to|towards)? midway': {
        text: "You head into the crowded midway.",
        nextScene: 'midway'
      },
      '(go|walk|head) (to|towards)? cavern': {
        text: "You head towards the dark attraction.",
        nextScene: 'cavern_entrance'
      }
    }
  },
  'midway': {
    id: 'midway',
    title: 'The Midway',
    description: "The midway is a dizzying array of games and food stalls. A fortune teller machine stands in the corner, its lights flickering. A group of teenagers is gathered around a 'Test Your Strength' machine. To the west is the Ferris Wheel. To the east is the Hall of Mirrors.",
    image: "https://picsum.photos/seed/carnival-midway/800/600",
    objects: ['zoltar'],
    exits: {
      'west': 'ferris_wheel',
      'east': 'hall_of_mirrors'
    },
    commands: {
      '(go|walk|head) west': {
        text: "You head towards the Ferris Wheel.",
        nextScene: 'ferris_wheel'
      },
      '(go|walk|head) east': {
        text: "You head towards the Hall of Mirrors.",
        nextScene: 'hall_of_mirrors'
      }
    }
  },
  'ferris_wheel': {
    id: 'ferris_wheel',
    title: 'The Ferris Wheel',
    description: "The Ferris Wheel towers over the carnival. You see a MAGIC COIN glinting in the grass near the ticket booth.",
    image: "https://picsum.photos/seed/ferris-wheel/800/600",
    objects: [],
    exits: {
      'back': 'midway'
    },
    commands: {
      '(take|get|pick up) coin': {
        text: "You pick up the Magic Carnival Coin.",
        getItem: 'magic_coin'
      },
      '(go|walk|head) back': {
        text: "You return to the midway.",
        nextScene: 'midway'
      }
    }
  },
  'hall_of_mirrors': {
    id: 'hall_of_mirrors',
    title: 'Hall of Mirrors',
    description: "Mirrors everywhere. You see dozens of versions of yourself—some young, some old. One mirror seems to show you as you truly feel inside.",
    image: "https://picsum.photos/seed/hall-mirrors/800/600",
    objects: [],
    exits: {
      'back': 'midway'
    },
    commands: {
      'look( at)?( the)? mirror': {
        text: "The mirror shows a 13-year-old boy with a big heart. It's a reminder of who you are."
      },
      '(go|walk|head) back': {
        text: "You return to the midway.",
        nextScene: 'midway'
      }
    }
  },
  'cavern_entrance': {
    id: 'cavern_entrance',
    title: 'Cavern Entrance',
    description: "You stand before the mouth of a cave. A neon sign flickers: 'CAVERN OF THE EVIL WIZARD'. The air coming from within is unnaturally cold. You see a FLASHLIGHT on a nearby crate.",
    image: "https://picsum.photos/seed/cave-mouth/800/600",
    objects: [],
    exits: {
      'in': 'frozen_cavern'
    },
    commands: {
      '(take|get|pick up) flashlight': {
        text: "You grab the flashlight. It feels solid.",
        getItem: 'flashlight'
      },
      '(enter|go in|go into) cavern': {
        text: "You step into the darkness.",
        nextScene: 'frozen_cavern'
      }
    }
  },
  'frozen_cavern': {
    id: 'frozen_cavern',
    title: 'The Frozen Cavern',
    description: "This is it. The scene from the game. The walls are covered in thick ice. In the center of the room stands the EVIL WIZARD, frozen in a block of crystal. He holds a staff that glows with a faint magenta light. To the left is a MELTING POD. To the right is a CHASM.",
    image: "https://picsum.photos/seed/frozen-cave/800/600",
    isCheckpoint: true,
    objects: [],
    exits: {},
    commands: {
      'look( at)?( the)? wizard': {
        text: "The wizard looks terrifying, even in ice. His eyes seem to follow you."
      },
      '(use|turn on) flashlight': {
        text: "The beam of light reflects off the ice, creating a dazzling display of colors."
      },
      'look( at)?( the)? pod': {
        text: "It's a high-tech thermal pod. It looks like it could melt the ice, but it needs to be aligned."
      },
      '(align|fix|set) pod': {
        text: "You attempt to align the pod. This is a critical moment.",
        nextScene: 'cutscene_decision'
      }
    }
  },
  'cutscene_decision': {
    id: 'cutscene_decision',
    title: 'A Critical Choice',
    description: "The thermal pod hums with power. You have a choice to make. Do you use the pod to MELT the wizard and claim his power, or do you SHATTER the ice and free the cavern from his influence? This decision will change everything.",
    objects: [],
    exits: {},
    commands: {
      '(melt|thaw) wizard': {
        text: "You activate the melting sequence. The ice begins to hiss and steam.",
        nextScene: 'branch_power'
      },
      '(shatter|break|smash) ice': {
        text: "You strike the ice with all your might. Cracks spread across the surface.",
        nextScene: 'branch_freedom'
      }
    }
  },
  'branch_power': {
    id: 'branch_power',
    title: 'The Path of Power',
    description: "The wizard is free. He bows to you, handing you his staff. 'You have chosen well,' he rasps. You feel a surge of dark energy. But as you look at your hands, you realize they're growing older... much older. You've traded your youth for power.",
    isCheckpoint: true,
    objects: [],
    exits: {},
    commands: {
      'look( at)?( the)? staff': {
        text: "The staff pulses with magenta light. It's yours now.",
        getItem: 'wizard_staff'
      },
      '(go|walk|head) deeper': {
        text: "You head deeper into the cavern, leaving your childhood behind.",
        nextScene: 'dark_throne'
      }
    }
  },
  'branch_freedom': {
    id: 'branch_freedom',
    title: 'The Path of Freedom',
    description: "The ice shatters. The wizard vanishes into mist. The cavern begins to warm. You feel a sense of lightness. You're still an adult, but your heart feels young. You realize that being 'big' isn't about power—it's about the choices you make.",
    isCheckpoint: true,
    objects: [],
    exits: {},
    commands: {
      'look around': {
        text: "The cavern is beautiful now, filled with glowing crystals that feel friendly."
      },
      '(go|walk|head) back': {
        text: "You head back towards the carnival, ready to live your life.",
        nextScene: 'ending_friends'
      }
    }
  },
  'dark_throne': {
    id: 'dark_throne',
    title: 'The Dark Throne',
    description: "You sit upon the obsidian throne. You are the new Evil Wizard. The cavern is yours. But you are alone. The friends you had are gone. The moments you should have savored are lost. You have reached the end, but at what cost?",
    objects: [],
    exits: {},
    commands: {
      '(reflect|think)': {
        text: "You realize that you were in such a rush to grow up that you forgot to be a kid.",
        nextScene: 'ending_lonely'
      }
    }
  },
  'ending_lonely': {
    id: 'ending_lonely',
    title: 'The Lonely End',
    description: "You are the most powerful wizard in the world, but you are also the loneliest man. The game ends here. Perhaps next time, you'll choose differently.",
    objects: [],
    exits: {},
    commands: {}
  },
  'ending_friends': {
    id: 'ending_friends',
    title: 'The True Victory',
    description: "You return to the carnival. You find your friends waiting for you. You realize that the important things in life are friends and savoring every moment, not being in a rush to grow up. You've won the game of life.",
    objects: [],
    exits: {},
    commands: {}
  },
  'cutscene_intro': {
    id: 'cutscene_intro',
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
  pendingItem: null
};
