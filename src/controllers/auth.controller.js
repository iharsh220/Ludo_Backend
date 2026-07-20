const Organogram = require('../models/organogram');
const jwt = require('jsonwebtoken');

const STATIC_PASSWORD = process.env.STATIC_PASSWORD || 'corium';
const JWT_SECRET = process.env.JWT_SECRET || 'corium_jwt_secret';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '7d';

const authController = {
  login: async (req, res) => {
    try {
      const { emp_code, password } = req.body;

      if (!emp_code || !password) {
        return res.status(400).json({
          success: false,
          message: 'emp_code and password are required'
        });
      }

      if (password !== STATIC_PASSWORD) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      const user = await Organogram.findOne({
        where: { emp_code },
        attributes: [
          'id', 'emp_code', 'emp_name', 'level', 'hq', 'region',
          'zone', 'division', 'sap', 'AM_employee_code',
          'RM_employee_code', 'ZM_employee_code', 'mobileno', 'email_id'
        ]
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }

      const token = jwt.sign(
        { user },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRE }
      );

      res.json({
        success: true,
        message: 'Login successful',
        token,
        data: user
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Login failed',
        error: error.message
      });
    }
  }
};

module.exports = authController;
