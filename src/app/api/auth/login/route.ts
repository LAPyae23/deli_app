// app/api/auth/login/route.ts
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();
    const { email, password, role } = body;

    // ၁။ Database ထဲမှာ အဆိုပါ Email နဲ့ Role ကိုက်ညီတဲ့ User ရှိမရှိ ရှာပါမယ်
    const user = await User.findOne({ email, role });
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Invalid credentials or role mismatch.' },
        { status: 401 }
      );
    }

    // ၂။ ပေးပို့လာတဲ့ Password နဲ့ Database ထဲက Hash လုပ်ထားတဲ့ Password ကိုက်ညီမှု ရှိမရှိ စစ်ဆေးပါမယ်
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return NextResponse.json(
        { success: false, message: 'Invalid credentials.' },
        { status: 401 }
      );
    }

    // ၃။ အားလုံးမှန်ကန်ရင် Success ပြန်ပေးပါမယ်
    // (တကယ့် Production မှာဆိုရင် ဒီနေရာမှာ JWT Token ထုတ်ပေးတာမျိုး လုပ်လေ့ရှိပါတယ်)
    return NextResponse.json({
      success: true,
      message: `Welcome back, ${user.firstName}!`,
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });

  } catch (error) {
    console.error("Login Error:", error);
    return NextResponse.json(
      { success: false, message: 'An error occurred during login.' },
      { status: 500 }
    );
  }
}