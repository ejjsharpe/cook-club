export interface UserData {
  id: string;
  name: string;
  email: string;
  password: string; // Will be hashed
  image?: string;
}

export const users: UserData[] = [
  {
    id: "user_001",
    name: "Emma Rodriguez",
    email: "emma.rodriguez@example.com",
    password: "Password123!",
    image: "https://i.pravatar.cc/150?img=1"
  },
  {
    id: "user_002",
    name: "James Chen",
    email: "james.chen@example.com",
    password: "Password123!",
    image: "https://i.pravatar.cc/150?img=12"
  },
  {
    id: "user_003",
    name: "Sophia Patel",
    email: "sophia.patel@example.com",
    password: "Password123!",
    image: "https://i.pravatar.cc/150?img=5"
  },
  {
    id: "user_004",
    name: "Marcus Johnson",
    email: "marcus.johnson@example.com",
    password: "Password123!",
    image: "https://i.pravatar.cc/150?img=13"
  },
  {
    id: "user_005",
    name: "Olivia Kim",
    email: "olivia.kim@example.com",
    password: "Password123!",
    image: "https://i.pravatar.cc/150?img=9"
  },
  {
    id: "user_006",
    name: "Liam O'Brien",
    email: "liam.obrien@example.com",
    password: "Password123!",
    image: "https://i.pravatar.cc/150?img=14"
  },
  {
    id: "user_007",
    name: "Ava Martinez",
    email: "ava.martinez@example.com",
    password: "Password123!",
    image: "https://i.pravatar.cc/150?img=10"
  },
  {
    id: "user_008",
    name: "Noah Anderson",
    email: "noah.anderson@example.com",
    password: "Password123!",
    image: "https://i.pravatar.cc/150?img=15"
  },
  {
    id: "user_009",
    name: "Isabella Nguyen",
    email: "isabella.nguyen@example.com",
    password: "Password123!",
    image: "https://i.pravatar.cc/150?img=16"
  },
  {
    id: "user_010",
    name: "Ethan Williams",
    email: "ethan.williams@example.com",
    password: "Password123!",
    image: "https://i.pravatar.cc/150?img=17"
  },
  {
    id: "user_011",
    name: "Mia Thompson",
    email: "mia.thompson@example.com",
    password: "Password123!",
    image: "https://i.pravatar.cc/150?img=20"
  },
  {
    id: "user_012",
    name: "Alexander Santos",
    email: "alex.santos@example.com",
    password: "Password123!",
    image: "https://i.pravatar.cc/150?img=18"
  }
];
