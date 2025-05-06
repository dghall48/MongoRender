// testmongo.js - Task Management System with MVC, Observer and Singleton patterns
const express = require('express');
const { MongoClient, ObjectId } = require("mongodb");
const session = require('express-session');

// ---- Singleton Pattern for Database Access ----
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

  // Get database collections
  async getTasksCollection() {
    const db = await this.connect();
    return db.collection('Tasks');
  }

  async getUsersCollection() {
    const db = await this.connect();
    return db.collection('Users');
  }

  async getStatsCollection() {
    const db = await this.connect();
    return db.collection('Stats');
  }
}

// ---- Observer Pattern for Statistics Tracking ----
class StatsObserver {
  constructor() {
    this.db = new DatabaseSingleton();
  }

  async update() {
    try {
      const tasksCollection = await this.db.getTasksCollection();
      
      // Count total volunteers across all tasks
      const tasks = await tasksCollection.find({}).toArray();
      let totalVolunteers = 0;
      
      tasks.forEach(task => {
        if (task.volunteers && Array.isArray(task.volunteers)) {
          totalVolunteers += task.volunteers.length;
        }
      });
      
      // Update stats in database
      const statsCollection = await this.db.getStatsCollection();
      await statsCollection.updateOne(
        { name: 'volunteers' },
        { 
          $set: { 
            count: totalVolunteers,
            taskCount: tasks.length,
            lastUpdated: new Date()
          }
        },
        { upsert: true }
      );
      
      console.log(`Stats updated: ${totalVolunteers} volunteers across ${tasks.length} tasks`);
    } catch (error) {
      console.error('Error updating stats:', error);
    }
  }
}

// ---- MVC Pattern Implementation ----

// Model
class TaskModel {
  constructor() {
    this.db = new DatabaseSingleton();
    this.observers = [new StatsObserver()];
  }

  async getAllTasks() {
    const tasksCollection = await this.db.getTasksCollection();
    return tasksCollection.find({}).toArray();
  }

  async getTaskById(id) {
    const tasksCollection = await this.db.getTasksCollection();
    return tasksCollection.findOne({ _id: new ObjectId(id) });
  }

  async getTasksForVolunteering(userId) {
    const tasksCollection = await this.db.getTasksCollection();
    // Find tasks where the user is not already a volunteer and not the owner
    return tasksCollection.find({
      owner: { $ne: userId },
      volunteers: { $not: { $elemMatch: { $eq: userId } } }
    }).toArray();
  }

  async getMyTasks(userId) {
    const tasksCollection = await this.db.getTasksCollection();
    // Find tasks where the user is the owner
    return tasksCollection.find({ owner: userId }).toArray();
  }

  async getMyVolunteeredTasks(userId) {
    const tasksCollection = await this.db.getTasksCollection();
    // Find tasks where the user is a volunteer
    return tasksCollection.find({ volunteers: userId }).toArray();
  }

  async createTask(taskData, ownerId) {
    const tasksCollection = await this.db.getTasksCollection();
    const result = await tasksCollection.insertOne({
      title: taskData.title,
      description: taskData.description,
      owner: ownerId,
      volunteers: [],
      completed: false,
      createdAt: new Date()
    });
    
    // Notify observers
    this.notifyObservers();
    
    return result;
  }

  async volunteerForTask(taskId, userId) {
    const tasksCollection = await this.db.getTasksCollection();
    const result = await tasksCollection.updateOne(
      { _id: new ObjectId(taskId) },
      { $addToSet: { volunteers: userId } }
    );
    
    // Notify observers
    this.notifyObservers();
    
    return result;
  }

  async removeVolunteer(taskId, volunteerId) {
    const tasksCollection = await this.db.getTasksCollection();
    const result = await tasksCollection.updateOne(
      { _id: new ObjectId(taskId) },
      { $pull: { volunteers: volunteerId } }
    );
    
    // Notify observers
    this.notifyObservers();
    
    return result;
  }

  async completeTask(taskId) {
    const tasksCollection = await this.db.getTasksCollection();
    const result = await tasksCollection.updateOne(
      { _id: new ObjectId(taskId) },
      { $set: { completed: true } }
    );
    
    // Notify observers
    this.notifyObservers();
    
    return result;
  }

  async deleteTask(taskId) {
    const tasksCollection = await this.db.getTasksCollection();
    const result = await tasksCollection.deleteOne({ _id: new ObjectId(taskId) });
    
    // Notify observers
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

// User Model
class UserModel {
  constructor() {
    this.db = new DatabaseSingleton();
  }

  async getUserById(id) {
    const usersCollection = await this.db.getUsersCollection();
    return usersCollection.findOne({ _id: new ObjectId(id) });
  }

  async getUserByUsername(username) {
    const usersCollection = await this.db.getUsersCollection();
    return usersCollection.findOne({ username: username });
  }

  async createUser(userData) {
    const usersCollection = await this.db.getUsersCollection();
    // In a real app, you would hash the password
    return usersCollection.insertOne({
      username: userData.username,
      password: userData.password,
      createdAt: new Date()
    });
  }
}

// Stats Model
class StatsModel {
  constructor() {
    this.db = new DatabaseSingleton();
  }

  async getStats() {
    const statsCollection = await this.db.getStatsCollection();
    return statsCollection.findOne({ name: 'volunteers' }) || { count: 0, taskCount: 0 };
  }
}

// Controller
class TaskController {
  constructor() {
    this.taskModel = new TaskModel();
    this.userModel = new UserModel();
    this.statsModel = new StatsModel();
  }

  async renderDashboard(req, res) {
    try {
      // Check if user is logged in
      if (!req.session.userId) {
        return res.redirect('/login');
      }

      // Fetch tasks and stats
      const user = await this.userModel.getUserById(req.session.userId);
      const myTasks = await this.taskModel.getMyTasks(req.session.userId);
      const volunteeringTasks = await this.taskModel.getTasksForVolunteering(req.session.userId);
      const myVolunteeredTasks = await this.taskModel.getMyVolunteeredTasks(req.session.userId);
      const stats = await this.statsModel.getStats();

      // Add volunteer usernames to the tasks
      const usersCollection = await new DatabaseSingleton().getUsersCollection();
      
      // Process my tasks to include volunteer details
      for (const task of myTasks) {
        const volunteerIds = task.volunteers || [];
        task.volunteerDetails = [];
        
        for (const volId of volunteerIds) {
          const volunteer = await this.userModel.getUserById(volId);
          if (volunteer) {
            task.volunteerDetails.push({
              id: volunteer._id,
              username: volunteer.username
            });
          }
        }
      }

      this.renderView(res, 'dashboard', {
        user: user,
        myTasks: myTasks,
        volunteeringTasks: volunteeringTasks,
        myVolunteeredTasks: myVolunteeredTasks,
        stats: stats
      });
    } catch (error) {
      console.error('Error rendering dashboard:', error);
      res.status(500).send('Something went wrong!');
    }
  }

  async renderLoginPage(req, res) {
    this.renderView(res, 'login');
  }

  async renderRegisterPage(req, res) {
    this.renderView(res, 'register');
  }

  async login(req, res) {
    try {
      const { username, password } = req.body;
      const user = await this.userModel.getUserByUsername(username);
      
      if (user && user.password === password) { // In a real app, use password hashing
        req.session.userId = user._id.toString();
        res.redirect('/');
      } else {
        this.renderView(res, 'login', { error: 'Invalid username or password' });
      }
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).send('Something went wrong!');
    }
  }

  async register(req, res) {
    try {
      const { username, password, confirmPassword } = req.body;
      
      if (password !== confirmPassword) {
        return this.renderView(res, 'register', { error: 'Passwords do not match' });
      }
      
      const existingUser = await this.userModel.getUserByUsername(username);
      if (existingUser) {
        return this.renderView(res, 'register', { error: 'Username already exists' });
      }
      
      const result = await this.userModel.createUser({ username, password });
      req.session.userId = result.insertedId.toString();
      res.redirect('/');
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).send('Something went wrong!');
    }
  }

  async logout(req, res) {
    req.session.destroy();
    res.redirect('/login');
  }

  async createTask(req, res) {
    try {
      if (!req.session.userId) {
        return res.redirect('/login');
      }
      
      await this.taskModel.createTask(req.body, req.session.userId);
      res.redirect('/');
    } catch (error) {
      console.error('Error creating task:', error);
      res.status(500).send('Something went wrong!');
    }
  }

  async volunteerForTask(req, res) {
    try {
      if (!req.session.userId) {
        return res.redirect('/login');
      }
      
      await this.taskModel.volunteerForTask(req.params.id, req.session.userId);
      res.redirect('/');
    } catch (error) {
      console.error('Error volunteering for task:', error);
      res.status(500).send('Something went wrong!');
    }
  }

  async removeVolunteer(req, res) {
    try {
      if (!req.session.userId) {
        return res.redirect('/login');
      }
      
      const task = await this.taskModel.getTaskById(req.params.taskId);
      
      if (!task || task.owner !== req.session.userId) {
        return res.status(403).send('Unauthorized');
      }
      
      await this.taskModel.removeVolunteer(req.params.taskId, req.params.volunteerId);
      res.redirect('/');
    } catch (error) {
      console.error('Error removing volunteer:', error);
      res.status(500).send('Something went wrong!');
    }
  }

  async deleteTask(req, res) {
    try {
      if (!req.session.userId) {
        return res.redirect('/login');
      }
      
      const task = await this.taskModel.getTaskById(req.params.id);
      
      if (!task || task.owner !== req.session.userId) {
        return res.status(403).send('Unauthorized');
      }
      
      await this.taskModel.deleteTask(req.params.id);
      res.redirect('/');
    } catch (error) {
      console.error('Error deleting task:', error);
      res.status(500).send('Something went wrong!');
    }
  }

  // View rendering helper
  renderView(res, view, data = {}) {
    // Simple view rendering with template strings
    switch (view) {
      case 'dashboard':
        res.send(this.getDashboardHTML(data));
        break;
      case 'login':
        res.send(this.getLoginHTML(data));
        break;
      case 'register':
        res.send(this.getRegisterHTML(data));
        break;
      default:
        res.send('View not found');
    }
  }

  // View templates
  getDashboardHTML(data) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Task Volunteer System</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            max-width: 1000px; 
            margin: 0 auto; 
            padding: 20px; 
            background-color: #2F4454; 
            color: #fff; 
          }
          h1, h2, h3 { color: #fff; }
          .container { display: flex; flex-wrap: wrap; gap: 20px; }
          .section { flex: 1; min-width: 300px; }
          .task { 
            border: 1px solid #ddd; 
            padding: 15px; 
            margin-bottom: 15px; 
            border-radius: 5px; 
            background-color: #376E6F; 
            color: #fff;
          }
          .stats {
            background-color: #376E6F;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
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
            padding: 10px 15px; 
            border: none; 
            cursor: pointer; 
            margin-right: 5px;
            text-decoration: none;
            display: inline-block;
            border-radius: 3px;
          }
          .delete-btn { background-color: #f44336; }
          .volunteer-btn { background-color: #2196F3; }
          header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid #4A6670;
          }
          .volunteer-list {
            margin-top: 10px;
            padding: 5px;
            background-color: #1C3334;
            border-radius: 3px;
          }
          .volunteer-item {
            display: flex;
            justify-content: space-between;
            padding: 5px;
            border-bottom: 1px solid #4A6670;
          }
          .volunteer-item:last-child {
            border-bottom: none;
          }
          label { color: #fff; }
        </style>
      </head>
      <body>
        <header>
          <h1>Task Volunteer System</h1>
          <div>
            <span>Welcome, ${data.user.username}</span>
            <a href="/logout" class="btn" style="background-color: #f44336;">Logout</a>
          </div>
        </header>
        
        <div class="stats">
          <h3>System Statistics</h3>
          <p>Total Tasks: ${data.stats.taskCount || 0}</p>
          <p>Total Volunteers: ${data.stats.count || 0}</p>
        </div>
        
        <div class="container">
          <div class="section">
            <h2>My Tasks (${data.myTasks.length})</h2>
            ${data.myTasks.length === 0 ? '<p>You haven\'t created any tasks yet.</p>' : ''}
            ${data.myTasks.map(task => `
              <div class="task">
                <h3>${task.title}</h3>
                <p>${task.description}</p>
                <p><strong>Status:</strong> ${task.completed ? 'Completed' : 'Active'}</p>
                
                <div class="volunteer-list">
                  <h4>Volunteers (${task.volunteers ? task.volunteers.length : 0})</h4>
                  ${task.volunteerDetails && task.volunteerDetails.length > 0 
                    ? task.volunteerDetails.map(vol => `
                        <div class="volunteer-item">
                          <span>${vol.username}</span>
                          <form action="/remove-volunteer/${task._id}/${vol.id}" method="POST" style="display: inline; margin: 0;">
                            <button type="submit" class="delete-btn">Remove</button>
                          </form>
                        </div>
                      `).join('')
                    : '<p>No volunteers yet</p>'
                  }
                </div>
                
                <div style="margin-top: 15px;">
                  <form action="/delete-task/${task._id}" method="POST" style="display: inline; margin: 0; padding: 0; border: none; background: none;">
                    <button type="submit" class="delete-btn">Delete Task</button>
                  </form>
                </div>
              </div>
            `).join('')}
            
            <h3>Create New Task</h3>
            <form action="/create-task" method="POST">
              <div>
                <label for="title">Title:</label>
                <input type="text" id="title" name="title" required>
              </div>
              <div>
                <label for="description">Description:</label>
                <textarea id="description" name="description" rows="4" required></textarea>
              </div>
              <button type="submit">Create Task</button>
            </form>
          </div>
          
          <div class="section">
            <h2>Available Tasks (${data.volunteeringTasks.length})</h2>
            ${data.volunteeringTasks.length === 0 ? '<p>No tasks available for volunteering.</p>' : ''}
            ${data.volunteeringTasks.map(task => `
              <div class="task">
                <h3>${task.title}</h3>
                <p>${task.description}</p>
                <p><strong>Status:</strong> ${task.completed ? 'Completed' : 'Active'}</p>
                <form action="/volunteer/${task._id}" method="POST">
                  <button type="submit" class="volunteer-btn">Volunteer for this Task</button>
                </form>
              </div>
            `).join('')}
            
            <h2>My Volunteered Tasks (${data.myVolunteeredTasks.length})</h2>
            ${data.myVolunteeredTasks.length === 0 ? '<p>You haven\'t volunteered for any tasks yet.</p>' : ''}
            ${data.myVolunteeredTasks.map(task => `
              <div class="task">
                <h3>${task.title}</h3>
                <p>${task.description}</p>
                <p><strong>Status:</strong> ${task.completed ? 'Completed' : 'Active'}</p>
              </div>
            `).join('')}
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getLoginHTML(data) {
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
          .switch {
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
          ${data.error ? `<div class="error">${data.error}</div>` : ''}
          
          <div>
            <label for="username">Username:</label>
            <input type="text" id="username" name="username" required>
          </div>
          
          <div>
            <label for="password">Password:</label>
            <input type="password" id="password" name="password" required>
          </div>
          
          <button type="submit">Login</button>
          
          <div class="switch">
            Don't have an account? <a href="/register">Register</a>
          </div>
        </form>
      </body>
      </html>
    `;
  }

  getRegisterHTML(data) {
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
          .switch {
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
          ${data.error ? `<div class="error">${data.error}</div>` : ''}
          
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
          
          <div class="switch">
            Already have an account? <a href="/login">Login</a>
          </div>
        </form>
      </body>
      </html>
    `;
  }
}

// Express App Setup
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'task-volunteer-secret',
  resave: false,
  saveUninitialized: false
}));

// Create controller instance
const taskController = new TaskController();

// Routes
app.get('/', (req, res) => taskController.renderDashboard(req, res));
app.get('/login', (req, res) => taskController.renderLoginPage(req, res));
app.get('/register', (req, res) => taskController.renderRegisterPage(req, res));
app.post('/login', (req, res) => taskController.login(req, res));
app.post('/register', (req, res) => taskController.register(req, res));
app.get('/logout', (req, res) => taskController.logout(req, res));
app.post('/create-task', (req, res) => taskController.createTask(req, res));
app.post('/volunteer/:id', (req, res) => taskController.volunteerForTask(req, res));
app.post('/remove-volunteer/:taskId/:volunteerId', (req, res) => taskController.removeVolunteer(req, res));
app.post('/delete-task/:id', (req, res) => taskController.deleteTask(req, res));

// Keep the original API route for backward compatibility
app.get('/api/mongo/:item', async (req, res) => {
  const db = new DatabaseSingleton();
  try {
    const partsCollection = await (await db.connect()).collection('MyStuff');
    const query = { partID: req.params.item };
    const part = await partsCollection.findOne(query);
    console.log(part);
    res.send('Found this: ' + JSON.stringify(part));
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Something went wrong!');
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`);
  
  // Initialize stats tracking
  const statsObserver = new StatsObserver();
  statsObserver.update();
});

// Graceful shutdown
process.on('SIGINT', async () => {
  const db = new DatabaseSingleton();
  await db.close();
  process.exit(0);
});
