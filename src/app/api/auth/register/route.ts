// app/api/auth/register/route.ts
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import bcrypt from 'bcryptjs'; // bcryptjs ကို import လုပ်ပါမယ်

export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json();

    // ၁။ Email ထပ်နေတာမျိုးရှိမရှိ စစ်ဆေးပါမယ်
    const existingUser = await User.findOne({ email: body.email });
    if (existingUser) {
      return NextResponse.json(
        { success: false, message: 'This email is already registered.' },
        { status: 400 }
      );
    }

    // ၂။ Password ကို Hash (Encrypt) လုပ်မယ့် အပိုင်း
    // Salt level ကို 10 ထားတာဟာ Security နဲ့ Performance မျှတတဲ့ Standard ဖြစ်ပါတယ်
    const salt = await bcrypt.genSalt(10); 
    const hashedPassword = await bcrypt.hash(body.password, salt);

    // ၃။ Database ထဲကို Hash လုပ်ထားတဲ့ Password အသစ်နဲ့ သိမ်းပါမယ်
    const newUser = await User.create({
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone,
      password: hashedPassword, // <--- User ရိုက်ထည့်လိုက်တဲ့ password အစစ်အစား hashed password ကို သုံးလိုက်ပါပြီ
      role: body.role,
    });

    console.log("Restaurant registered securely with hashed password!");

    return NextResponse.json(
      { success: true, message: 'Account created successfully!' },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration Error:", error);
    return NextResponse.json(
      { success: false, message: 'Unable to register account' },
      { status: 500 }
    );
  }
}