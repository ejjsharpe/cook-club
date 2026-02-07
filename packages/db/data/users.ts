export interface UserData {
  id: string;
  name: string;
  username: string;
  email: string;
  password: string; // Will be hashed
  image?: string;
}

export const users: UserData[] = [
  {
    id: "user_001",
    name: "Emma Rodriguez",
    username: "emmarod",
    email: "emma.rodriguez@example.com",
    password: "Password123!",
    image: "https://i.pravatar.cc/150?img=1"
  },
  {
    id: "user_002",
    name: "James Chen",
    username: "jameschen",
    email: "james.chen@example.com",
    password: "Password123!",
    image: "https://i.pravatar.cc/150?img=12"
  },
  {
    id: "user_003",
    name: "Sophia Patel",
    username: "sophiapatel",
    email: "sophia.patel@example.com",
    password: "Password123!",
    image: "https://i.pravatar.cc/150?img=5"
  },
  {
    id: "user_004",
    name: "Marcus Johnson",
    username: "marcusj",
    email: "marcus.johnson@example.com",
    password: "Password123!",
    image: "https://i.pravatar.cc/150?img=13"
  },
  {
    id: "user_005",
    name: "Olivia Kim",
    username: "oliviakim",
    email: "olivia.kim@example.com",
    password: "Password123!",
    image: "https://i.pravatar.cc/150?img=9"
  },
  {
    id: "user_006",
    name: "Liam O'Brien",
    username: "liamobrien",
    email: "liam.obrien@example.com",
    password: "Password123!",
    image: "https://i.pravatar.cc/150?img=14"
  },
  {
    id: "user_007",
    name: "Ava Martinez",
    username: "avamartinez",
    email: "ava.martinez@example.com",
    password: "Password123!",
    image: "https://i.pravatar.cc/150?img=10"
  },
  {
    id: "user_008",
    name: "Noah Anderson",
    username: "noahanderson",
    email: "noah.anderson@example.com",
    password: "Password123!",
    image: "https://i.pravatar.cc/150?img=15"
  },
  {
    id: "user_009",
    name: "Isabella Nguyen",
    username: "bellanguyen",
    email: "isabella.nguyen@example.com",
    password: "Password123!",
    image: "https://i.pravatar.cc/150?img=16"
  },
  {
    id: "user_010",
    name: "Ethan Williams",
    username: "ethanw",
    email: "ethan.williams@example.com",
    password: "Password123!",
    image: "https://i.pravatar.cc/150?img=17"
  },
  {
    id: "user_011",
    name: "Mia Thompson",
    username: "miathompson",
    email: "mia.thompson@example.com",
    password: "Password123!",
    image: "https://i.pravatar.cc/150?img=20"
  },
  {
    id: "user_012",
    name: "Alexander Santos",
    username: "alexsantos",
    email: "alex.santos@example.com",
    password: "Password123!",
    image: "https://i.pravatar.cc/150?img=18"
  },
  {
    id: "user_013",
    name: "Chloe Harper",
    username: "chloeharper",
    email: "chloe.harper@example.com",
    password: "Password123!",
    image: "https://i.pravatar.cc/150?img=23"
  },
  {
    id: "user_014",
    name: "Daniel Park",
    username: "danielpark",
    email: "daniel.park@example.com",
    password: "Password123!",
    image: "https://i.pravatar.cc/150?img=52"
  }
];
