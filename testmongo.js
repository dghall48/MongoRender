// Task Volunteer System
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const crypto = require('crypto');

class DatabaseSingleton {
  constructor() {
    if (DatabaseSingleton.instance) {
      return DatabaseSingleton.instance;
    }
    
    this.uri = "mongodb+srv://danielhall:12345@cluster0.fsylgfp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
    this.client = new MongoClient(this.uri);
    this.connected = false;
    DatabaseSingleton.instance = this;
  }

  async connect() {
    if (!this.connected) {
      await this.client.connect();
      this.db = this.client.db('MyDBexample');
      this.connected = true;
      console.log('Connected to MongoDB');
    }
    return this.db;
  }

  async close() {
    if (this.connected) {
      await this.client.close();
      this.connected = false;
      console.log('Disconnected from MongoDB');
    }
  }
}

class StatsObserver {
  constructor() {
    this.db = new DatabaseSingleton();
  }

  async update() {
    try {
      const db = await this.db.connect();
      
      // Count total volunteers across all tasks
      const tasks = await db.collection('Tasks').find({}).toArray();
      
      let totalVolunteers = 0;
      let uniqueVolunteers = new Set();
      let activeTasks = 0;
      
      tasks.forEach(task => {
        if (!task.completed) {
          activeTasks++;
          if (task.volunteers && Array.isArray(task.volunteers)) {
            totalVolunteers += task.volunteers.length;
            task.volunteers.forEach(vol => uniqueVolunteers.add(vol));
          }
        }
      });
      
      // Update stats in database
      await db.collection('Stats').updateOne(
        { name: 'volunteerStats' },
        { 
          $set: { 
            totalVolunteers,
            uniqueVolunteers: uniqueVolunteers.size,
            activeTasks,
            lastUpdated: new Date()
          }
        },
        { upsert: true }
      );
      
      console.log(`Stats updated: ${totalVolunteers} volunteer positions filled across ${activeTasks} active tasks`);
    } catch (error) {
      console.error('Error updating stats:', error);
    }
  }
}

class TaskModel {
  constructor() {
    this.db = new DatabaseSingleton();
    this.observers = [new StatsObserver()];
  }

  // Get all tasks
  async getAllTasks() {
    const db = await this.db.connect();
    return db.collection('Tasks').find({}).toArray();
  }

  // Get tasks by owner
  async getTasksByOwner(ownerId) {
    const db = await this.db.connect();
    return db.collection('Tasks').find({ ownerId }).toArray();
  }

  // Get tasks available for volunteering
  async getTasksForVolunteering(userId) {
    const db = await this.db.connect();
    return db.collection('Tasks').find({
      ownerId: { $ne: userId },
      completed: false,
      volunteers: { $not: { $elemMatch: { $eq: userId } } }
    }).toArray();
  }

  // Get tasks user has volunteered for
  async getVolunteeredTasks(userId) {
    const db = await this.db.connect();
    return db.collection('Tasks').find({
      volunteers: userId,
      completed: false
    }).toArray();
  }

  // Create new task
  async createTask(title, description, ownerId) {
    const db = await this.db.connect();
    const result = await db.collection('Tasks').insertOne({
      title,
      description,
      ownerId,
      completed: false,
      volunteers: [],
      createdAt: new Date()
    });
    
    this.notifyObservers();
    return result;
  }

  // Volunteer for a task
  async volunteerForTask(taskId, userId) {
    const db = await this.db.connect();
    const result = await db.collection('Tasks').updateOne(
      { _id: new ObjectId(taskId) },
      { $addToSet: { volunteers: userId } }
    );
    
    this.notifyObservers();
    return result;
  }

  // Remove volunteer from task
  async removeVolunteer(taskId, volunteerId) {
    const db = await this.db.connect();
    const result = await db.collection('Tasks').updateOne(
      { _id: new ObjectId(taskId) },
      { $pull: { volunteers: volunteerId } }
    );
    
    this.notifyObservers();
    return result;
  }

  // Toggle task completion
  async toggleTaskCompletion(taskId, ownerId) {
    const db = await this.db.connect();
    
    // Get current task
    const task = await db.collection('Tasks').findOne({ 
      _id: new ObjectId(taskId),
      ownerId
    });
    
    if (!task) return null;
    
    // Toggle completion status
    const result = await db.collection('Tasks').updateOne(
      { _id: new ObjectId(taskId) },
      { $set: { completed: !task.completed } }
    );
    
    this.notifyObservers();
    return result;
  }

  // Delete task
  async deleteTask(taskId, ownerId) {
    const db = await this.db.connect();
    const result = await db.collection('Tasks').deleteOne({ 
      _id: new ObjectId(taskId),
      ownerId
    });
    
    this.notifyObservers();
    return result;
  }

  // Observer pattern methods
  addObserver(observer) {
    this.observers.push(observer);
  }

  notifyObservers() {
    this.observers.forEach(observer => observer.update());
  }
}

class UserModel {
  constructor() {
    this.db = new DatabaseSingleton();
  }

  // Create new user
  async createUser(username, password) {
    const db = await this.db.connect();
    const hashedPassword = this.hashPassword(password);
    
    return db.collection('Users').insertOne({
      username,
      password: hashedPassword,
      createdAt: new Date()
    });
  }

  // Verify username and password
  async verifyUser(username, password) {
    const db = await this.db.connect();
    const user = await db.collection('Users').findOne({ username });
    
    if (!user) return null;
    
    const hashedPassword = this.hashPassword(password);
    if (user.password !== hashedPassword) return null;
    
    return user;
  }

  // Get user by ID
  async getUserById(userId) {
    if (!userId) return null;
    
    const db = await this.db.connect();
    return db.collection('Users').findOne({ _id: new ObjectId(userId) });
  }

  // Get user by username
  async getUserByUsername(username) {
    const db = await this.db.connect();
    return db.collection('Users').findOne({ username });
  }

  // Check if username already exists
  async usernameExists(username) {
    const db = await this.db.connect();
    const count = await db.collection('Users').countDocuments({ username });
    return count > 0;
  }

  // Get user details by array of IDs
  async getUsersByIds(userIds) {
    const db = await this.db.connect();
    
    if (!userIds || userIds.length === 0) return [];
    
    // Convert string IDs to ObjectIds
    const objectIds = userIds.map(id => new ObjectId(id));
    
    return db.collection('Users').find({
      _id: { $in: objectIds }
    }).toArray();
  }

  // Hash password
  hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
  }
}

class StatsModel {
  constructor() {
    this.db = new DatabaseSingleton();
  }

  // Get current statistics
  async getStats() {
    const db = await this.db.connect();
    return db.collection('Stats').findOne({ name: 'volunteerStats' }) || {
      totalVolunteers: 0,
      uniqueVolunteers: 0,
      activeTasks: 0,
      lastUpdated: new Date()
    };
  }
}

class TaskController {
  constructor() {
    this.taskModel = new TaskModel();
    this.userModel = new UserModel();
    this.statsModel = new StatsModel();
  }

  // Render landing page
  renderLandingPage(req, res) {
    res.send(this.landingPageView());
  }

  // Render login page
  renderLoginPage(req, res, error = null) {
    res.send(this.loginPageView(error));
  }

  // Render register page
  renderRegisterPage(req, res, error = null) {
    res.send(this.registerPageView(error));
  }

  // Handle login
  async handleLogin(req, res) {
    try {
      const { username, password } = req.body;
      
      // Verify user
      const user = await this.userModel.verifyUser(username, password);
      
      if (!user) {
        return this.renderLoginPage(req, res, 'Invalid username or password');
      }
      
      // Generate token (simple implementation)
      const token = crypto.randomBytes(16).toString('hex');
      
      // Redirect to dashboard
      res.redirect(`/dashboard?token=${token}&userId=${user._id}`);
    } catch (error) {
      console.error('Login error:', error);
      this.renderLoginPage(req, res, 'An error occurred during login');
    }
  }

  // Handle register
  async handleRegister(req, res) {
    try {
      const { username, password, confirmPassword } = req.body;
      
      // Check if passwords match
      if (password !== confirmPassword) {
        return this.renderRegisterPage(req, res, 'Passwords do not match');
      }
      
      // Check if username already exists
      const exists = await this.userModel.usernameExists(username);
      if (exists) {
        return this.renderRegisterPage(req, res, 'Username already exists');
      }
      
      // Create user
      const result = await this.userModel.createUser(username, password);
      
      // Generate token (simple implementation)
      const token = crypto.randomBytes(16).toString('hex');
      
      // Redirect to dashboard
      res.redirect(`/dashboard?token=${token}&userId=${result.insertedId}`);
    } catch (error) {
      console.error('Registration error:', error);
      this.renderRegisterPage(req, res, 'An error occurred during registration');
    }
  }

  // Render dashboard
  async renderDashboard(req, res) {
    try {
      const { token, userId } = req.query;
      
      // Verify token and userId (simple implementation)
      if (!token || !userId) {
        return res.redirect('/login');
      }
      
      // Get user
      const user = await this.userModel.getUserById(userId);
      if (!user) {
        return res.redirect('/login');
      }
      
      // Get tasks owned by user
      const ownedTasks = await this.taskModel.getTasksByOwner(userId);
      
      // For each owned task, get volunteer details
      for (const task of ownedTasks) {
        if (task.volunteers && task.volunteers.length > 0) {
          const volunteers = await this.userModel.getUsersByIds(task.volunteers);
          task.volunteerDetails = volunteers.map(v => ({
            id: v._id,
            username: v.username
          }));
        } else {
          task.volunteerDetails = [];
        }
      }
      
      // Get tasks available for volunteering
      const availableTasks = await this.taskModel.getTasksForVolunteering(userId);
      
      // Get tasks user has volunteered for
      const volunteeredTasks = await this.taskModel.getVolunteeredTasks(userId);
      
      // Get statistics
      const stats = await this.statsModel.getStats();
      
      // Render dashboard view
      res.send(this.dashboardView({
        user,
        token,
        userId,
        ownedTasks,
        availableTasks,
        volunteeredTasks,
        stats
      }));
    } catch (error) {
      console.error('Dashboard error:', error);
      res.status(500).send('Something went wrong!');
    }
  }

  // Create new task
  async createTask(req, res) {
    try {
      const { token, userId } = req.query;
      const { title, description } = req.body;
      
      if (!token || !userId || !title || !description) {
        return res.redirect('/login');
      }
      
      await this.taskModel.createTask(title, description, userId);
      
      res.redirect(`/dashboard?token=${token}&userId=${userId}`);
    } catch (error) {
      console.error('Create task error:', error);
      res.status(500).send('Something went wrong!');
    }
  }

  // Volunteer for task
  async volunteerForTask(req, res) {
    try {
      const { token, userId } = req.query;
      const taskId = req.params.id;
      
      if (!token || !userId || !taskId) {
        return res.redirect('/login');
      }
      
      await this.taskModel.volunteerForTask(taskId, userId);
      
      res.redirect(`/dashboard?token=${token}&userId=${userId}`);
    } catch (error) {
      console.error('Volunteer error:', error);
      res.status(500).send('Something went wrong!');
    }
  }

  // Remove volunteer from task
  async removeVolunteer(req, res) {
    try {
      const { token, userId } = req.query;
      const taskId = req.params.taskId;
      const volunteerId = req.params.volunteerId;
      
      if (!token || !userId || !taskId || !volunteerId) {
        return res.redirect('/login');
      }
      
      await this.taskModel.removeVolunteer(taskId, volunteerId);
      
      res.redirect(`/dashboard?token=${token}&userId=${userId}`);
    } catch (error) {
      console.error('Remove volunteer error:', error);
      res.status(500).send('Something went wrong!');
    }
  }

  // Toggle task completion
  async toggleTaskCompletion(req, res) {
    try {
      const { token, userId } = req.query;
      const taskId = req.params.id;
      
      if (!token || !userId || !taskId) {
        return res.redirect('/login');
      }
      
      await this.taskModel.toggleTaskCompletion(taskId, userId);
      
      res.redirect(`/dashboard?token=${token}&userId=${userId}`);
    } catch (error) {
      console.error('Toggle task error:', error);
      res.status(500).send('Something went wrong!');
    }
  }

  // Delete task
  async deleteTask(req, res) {
    try {
      const { token, userId } = req.query;
      const taskId = req.params.id;
      
      if (!token || !userId || !taskId) {
        return res.redirect('/login');
      }
      
      await this.taskModel.deleteTask(taskId, userId);
      
      res.redirect(`/dashboard?token=${token}&userId=${userId}`);
    } catch (error) {
      console.error('Delete task error:', error);
      res.status(500).send('Something went wrong!');
    }
  }
  // Landing page view
  landingPageView() {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Task Volunteer System</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            max-width: 800px; 
            margin: 0 auto; 
            padding: 20px; 
            background-color: #2F4454; 
            color: #fff; 
          }
          h1, h2 { color: #fff; text-align: center; }
          .container {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin-top: 50px;
          }
          .card {
            background-color: #376E6F;
            border-radius: 5px;
            padding: 20px;
            width: 300px;
            text-align: center;
          }
          .btn {
            display: inline-block;
            background-color: #4CAF50;
            color: white;
            padding: 10px 20px;
            text-decoration: none;
            border-radius: 4px;
            margin-top: 15px;
            font-weight: bold;
          }
          p { margin-bottom: 25px; }
        </style>
      </head>
      <body>
        <h1>Task Volunteer System</h1>
        <p style="text-align: center;">Create tasks, volunteer, and collaborate with others</p>
        
        <div class="container">
          <div class="card">
            <h2>New User?</h2>
            <p>Create an account to start creating tasks and volunteering</p>
            <a href="/register" class="btn">Register</a>
          </div>
          
          <div class="card">
            <h2>Returning User?</h2>
            <p>Sign in to view your tasks and volunteer opportunities</p>
            <a href="/login" class="btn">Login</a>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Login page view
  loginPageView(error = null) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Login - Task Volunteer System</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            max-width: 400px; 
            margin: 0 auto; 
            padding: 20px; 
            background-color: #2F4454; 
            color: #fff; 
          }
          h1 { color: #fff; text-align: center; }
          form { 
            margin-top: 20px; 
            border: 1px solid #ddd; 
            padding: 20px; 
            border-radius: 5px; 
            background-color: #376E6F; 
          }
          input { 
            width: 100%; 
            padding: 8px; 
            margin-bottom: 15px; 
            box-sizing: border-box; 
            background-color: #1C3334; 
            color: #fff; 
            border: 1px solid #4A6670; 
          }
          button { 
            background-color: #4CAF50; 
            color: white; 
            padding: 10px 15px; 
            border: none; 
            cursor: pointer; 
            width: 100%;
          }
          .error {
            color: #ff6b6b;
            margin-bottom: 15px;
          }
          .links {
            text-align: center;
            margin-top: 15px;
          }
          a { color: #4CAF50; }
        </style>
      </head>
      <body>
        <h1>Task Volunteer System</h1>
        
        <form action="/login" method="POST">
          <h2>Login</h2>
          ${error ? `<div class="error">${error}</div>` : ''}
          
          <div>
            <label for="username">Username:</label>
            <input type="text" id="username" name="username" required>
          </div>
          
          <div>
            <label for="password">Password:</label>
            <input type="password" id="password" name="password" required>
          </div>
          
          <button type="submit">Login</button>
          
          <div class="links">
            <p>Don't have an account? <a href="/register">Register</a></p>
            <p><a href="/">Back to Home</a></p>
          </div>
        </form>
      </body>
      </html>
    `;
  }

  // Register page view
  registerPageView(error = null) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Register - Task Volunteer System</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            max-width: 400px; 
            margin: 0 auto; 
            padding: 20px; 
            background-color: #2F4454; 
            color: #fff; 
          }
          h1 { color: #fff; text-align: center; }
          form { 
            margin-top: 20px; 
            border: 1px solid #ddd; 
            padding: 20px; 
            border-radius: 5px; 
            background-color: #376E6F; 
          }
          input { 
            width: 100%; 
            padding: 8px; 
            margin-bottom: 15px; 
            box-sizing: border-box; 
            background-color: #1C3334; 
            color: #fff; 
            border: 1px solid #4A6670; 
          }
          button { 
            background-color: #4CAF50; 
            color: white; 
            padding: 10px 15px; 
            border: none; 
            cursor: pointer; 
            width: 100%;
          }
          .error {
            color: #ff6b6b;
            margin-bottom: 15px;
          }
          .links {
            text-align: center;
            margin-top: 15px;
          }
          a { color: #4CAF50; }
        </style>
      </head>
      <body>
        <h1>Task Volunteer System</h1>
        
        <form action="/register" method="POST">
          <h2>Register</h2>
          ${error ? `<div class="error">${error}</div>` : ''}
          
          <div>
            <label for="username">Username:</label>
            <input type="text" id="username" name="username" required>
          </div>
          
          <div>
            <label for="password">Password:</label>
            <input type="password" id="password" name="password" required>
          </div>
          
          <div>
            <label for="confirmPassword">Confirm Password:</label>
            <input type="password" id="confirmPassword" name="confirmPassword" required>
          </div>
          
          <button type="submit">Register</button>
          
          <div class="links">
            <p>Already have an account? <a href="/login">Login</a></p>
            <p><a href="/">Back to Home</a></p>
          </div>
        </form>
      </body>
      </html>
    `;
  }

  // Dashboard view
  dashboardView(data) {
    const { user, token, userId, ownedTasks, availableTasks, volunteeredTasks, stats } = data;
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Dashboard - Task Volunteer System</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            max-width: 1200px; 
            margin: 0 auto; 
            padding: 20px; 
            background-color: #2F4454; 
            color: #fff; 
          }
          h1, h2, h3 { color: #fff; }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid #4A6670;
          }
          .stats-bar {
            background-color: #376E6F;
            border-radius: 5px;
            padding: 15px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-around;
          }
          .stat-box {
            text-align: center;
          }
          .stat-box .number {
            font-size: 24px;
            font-weight: bold;
            margin: 5px 0;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 20px;
          }
          .section {
            margin-bottom: 20px;
          }
          .task { 
            border: 1px solid #ddd; 
            padding: 15px; 
            margin-bottom: 15px; 
            border-radius: 5px; 
            background-color: #376E6F; 
            color: #fff;
          }
          .task.completed {
            opacity: 0.7;
          }
          .task-status {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .status-active {
            background-color: #4CAF50;
          }
          .status-completed {
            background-color: #9e9e9e;
          }
          .volunteers-list {
            background-color: #1C3334;
            border-radius: 4px;
            padding: 10px;
            margin-top: 10px;
            max-height: 120px;
            overflow-y: auto;
          }
          .volunteer-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 5px 0;
            border-bottom: 1px solid #4A6670;
          }
          .volunteer-item:last-child {
            border-bottom: none;
          }
          form { 
            margin-top: 20px; 
            border: 1px solid #ddd; 
            padding: 20px; 
            border-radius: 5px; 
            background-color: #376E6F; 
          }
          input, textarea { 
            width: 100%; 
            padding: 8px; 
            margin-bottom: 10px; 
            box-sizing: border-box; 
            background-color: #1C3334; 
            color: #fff; 
            border: 1px solid #4A6670; 
          }
          button, .btn { 
            background-color: #4CAF50; 
            color: white; 
            padding: 8px 12px; 
            border: none; 
            cursor: pointer; 
            border-radius: 4px;
            text-decoration: none;
            font-size: 14px;
          }
          .btn-sm {
            padding: 4px 8px;
            font-size: 12px;
          }
          .delete-btn { background-color: #f44336; }
          .volunteer-btn { background-color: #2196F3; }
          .logout-btn { background-color: #f44336; }
          .toggle-btn { background-color: #FF9800; }
          .task-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 10px;
          }
          .empty-list {
            text-align: center;
            padding: 20px;
            background-color: #1C3334;
            border-radius: 5px;
            font-style: italic;
            color: #9e9e9e;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Task Volunteer System</h1>
          <div>
            <span>Welcome, ${user.username}</span>
            <a href="/" class="btn logout-btn">Logout</a>
          </div>
        </div>
        
        <div class="stats-bar">
          <div class="stat-box">
            <div>Active Tasks</div>
            <div class="number">${stats.activeTasks}</div>
          </div>
          <div class="stat-box">
            <div>Volunteer Positions</div>
            <div class="number">${stats.totalVolunteers}</div>
          </div>
          <div class="stat-box">
            <div>Unique Volunteers</div>
            <div class="number">${stats.uniqueVolunteers}</div>
          </div>
        </div>
        
        <div class="grid">
          <div class="section">
            <h2>My Tasks</h2>
            
            ${ownedTasks.length === 0 ? 
              '<div class="empty-list">You haven\'t created any tasks yet.</div>' : 
              ownedTasks.map(task => `
                <div class="task ${task.completed ? 'completed' : ''}">
                  <span class="task-status ${task.completed ? 'status-completed' : 'status-active'}">
                    ${task.completed ? 'Completed' : 'Active'}
                  </span>
                  <h3>${task.title}</h3>
                  <p>${task.description}</p>
                  
                  <div class="volunteers-list">
                    <h4>Volunteers (${task.volunteers ? task.volunteers.length : 0})</h4>
                    ${task.volunteerDetails && task.volunteerDetails.length > 0 ? 
                      task.volunteerDetails.map(volunteer => `
                        <div class="volunteer-item">
                          <span>${volunteer.username}</span>
                          <form action="/remove-volunteer/${task._id}/${volunteer.id}?token=${token}&userId=${userId}" method="POST" style="margin: 0; padding: 0; border: none; background: none; display: inline;">
                            <button type="submit" class="btn-sm delete-btn">Remove</button>
                          </form>
                        </div>
                      `).join('') : 
                      '<p>No volunteers yet</p>'
                    }
                  </div>
                  
                  <div class="task-actions">
                    <form action="/toggle-task/${task._id}?token=${token}&userId=${userId}" method="POST" style="margin: 0; padding: 0; border: none; background: none; display: inline;">
                      <button type="submit" class="toggle-btn">${task.completed ? 'Mark Active' : 'Mark Completed'}</button>
                    </form>
                    <form action="/delete-task/${task._id}?token=${token}&userId=${userId}" method="POST" style="margin: 0; padding: 0; border: none; background: none; display: inline;">
                      <button type="submit" class="delete-btn">Delete</button>
                    </form>
                  </div>
                </div>
              `).join('')
            }
            
            <h3>Create New Task</h3>
            <form action="/create-task?token=${token}&userId=${userId}" method="POST">
              <div>
                <label for="title">Title:</label>
                <input type="text" id="title" name="title" required>
              </div>
              <div>
                <label for="description">Description:</label>
                <textarea id="description" name="description" rows="4" required></textarea>
              </div>
              <button type="submit" class="btn">Create Task</button>
            </form>
          </div>
          
          <div class="section">
            <h2>Available Tasks</h2>
            ${availableTasks.length === 0 ? 
              '<div class="empty-list">No tasks available for volunteering.</div>' : 
              availableTasks.map(task => `
                <div class="task">
                  <h3>${task.title}</h3>
                  <p>${task.description}</p>
                  <p><strong>Volunteers:</strong> ${task.volunteers ? task.volunteers.length : 0}</p>
                  <div class="task-actions">
                    <form action="/volunteer/${task._id}?token=${token}&userId=${userId}" method="POST">
                      <button type="submit" class="volunteer-btn">Volunteer for this Task</button>
                    </form>
                  </div>
                </div>
              `).join('')
            }
            
            <h2>My Volunteered Tasks</h2>
            ${volunteeredTasks.length === 0 ? 
              '<div class="empty-list">You haven\'t volunteered for any tasks yet.</div>' : 
              volunteeredTasks.map(task => `
                <div class="task">
                  <h3>${task.title}</h3>
                  <p>${task.description}</p>
                  <p><strong>Total Volunteers:</strong> ${task.volunteers ? task.volunteers.length : 0}</p>
                </div>
              `).join('')
            }
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

const taskController = new TaskController();

// Routes
app.get('/', (req, res) => taskController.renderLandingPage(req, res));
app.get('/login', (req, res) => taskController.renderLoginPage(req, res));
app.get('/register', (req, res) => taskController.renderRegisterPage(req, res));
app.post('/login', (req, res) => taskController.handleLogin(req, res));
app.post('/register', (req, res) => taskController.handleRegister(req, res));
app.get('/dashboard', (req, res) => taskController.renderDashboard(req, res));
app.post('/create-task', (req, res) => taskController.createTask(req, res));
app.post('/volunteer/:id', (req, res) => taskController.volunteerForTask(req, res));
app.post('/remove-volunteer/:taskId/:volunteerId', (req, res) => taskController.removeVolunteer(req, res));
app.post('/toggle-task/:id', (req, res) => taskController.toggleTaskCompletion(req, res));
app.post('/delete-task/:id', (req, res) => taskController.deleteTask(req, res));

app.get('/say/:name', function(req, res) {
  res.send('Hello ' + req.params.name + '!');
});

app.get('/api/mongo/:item', async function(req, res) {
  try {
    const db = await new DatabaseSingleton().connect();
    const parts = db.collection('MyStuff');
    const query = { partID: req.params.item };
    const part = await parts.findOne(query);
    console.log(part);
    res.send('Found this: ' + JSON.stringify(part));
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Something went wrong!');
  }
});

// Initialize database
async function initializeDatabase() {
  try {
    const db = await new DatabaseSingleton().connect();
    
    // Ensure collections exist
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    // Create necessary collections if they don't exist
    const requiredCollections = ['Tasks', 'Users', 'Stats'];
    
    for (const collection of requiredCollections) {
      if (!collectionNames.includes(collection)) {
        await db.createCollection(collection);
        console.log(`Created ${collection} collection`);
      }
    }
    
    // Initialize stats
    const statsObserver = new StatsObserver();
    await statsObserver.update();
    
    console.log('Database initialized');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// Start server
app.listen(port, async () => {
  console.log(`Server started at http://localhost:${port}`);
  await initializeDatabase();
});

// Close MongoDB connection when the app is terminated
process.on('SIGINT', async () => {
  await new DatabaseSingleton().close();
  console.log('MongoDB connection closed');
  process.exit(0);
});
