const Register = require("../../models/providers/registerSchema");
const bcrypt = require("bcryptjs");

// REGISTER
exports.register = async (req, res) => {
  try {
    const { name, companyName, email, password } = req.body;

    // validation
    if (!name || !companyName || !email || !password) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    // check existing register
    const existing = await Register.findOne({ email });
    if (existing) {
      return res.status(409).json({
        message: "Email already exists",
      });
    }

    // hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // create register
    const register = await Register.create({
      name,
      companyName,
      email,
      password: hashedPassword,
    });

    return res.status(201).json({
      message: "Register created successfully",
      register: {
        id: register._id,
        registerId: register.registerId,
        name: register.name,
        companyName: register.companyName,
        email: register.email,
        role: register.role,
        createdAt: register.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
    });
  }
};