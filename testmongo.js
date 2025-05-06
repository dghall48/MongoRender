// Simple Task Manager with MongoDB integration and basic authentication
const express = require('express');
const { MongoClient, ObjectId } = require("mongodb");
const crypto = require('crypto'); // Built-in Node.js module for password hashing

// MongoDB connection string
const uri = "mongodb+srv://danielhall:12345@cluster0.fsylgfp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const client = new MongoClient(uri);

// Express app setup
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Simple function to hash passwords
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Database connection
async function connectToDatabase() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    return client.db('MyDBexample');
  } catch (error) {
    console.error('Could not connect to MongoDB', error);
    process.exit(1);
  }
}

// Routes

// Landing page
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Task Manager</title>
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
      <h1>Welcome to Task Manager</h1>
      <p style="text-align: center;">Manage your tasks and track your progress</p>
      
      <div class="container">
        <div class="card">
          <h2>New User?</h2>
          <p>Create an account to start managing your tasks</p>
          <a href="/register" class="btn">Register</a>
        </div>
        
        <div class="card">
          <h2>Returning User?</h2>
          <p>Sign in to view and manage your tasks</p>
          <a href="/login" class="btn">Login</a>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Login page
app.get('/login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Login - Task Manager</title>
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
      <h1>Task Manager</h1>
      
      <form action="/login" method="POST">
        <h2>Login</h2>
        
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
  `);
});

// Register page
app.get('/register', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Register - Task Manager</title>
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
      <h1>Task Manager</h1>
      
      <form action="/register" method="POST">
        <h2>Register</h2>
        
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
  `);
});

// Login POST handler
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const db = await connectToDatabase();
    
    // Find user in database
    const user = await db.collection('Users').findOne({ username });
    
    // Check if user exists and password matches
    if (!user || user.password !== hashPassword(password)) {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Login Failed - Task Manager</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              max-width: 400px; 
              margin: 0 auto; 
              padding: 20px; 
              background-color: #2F4454; 
              color: #fff; 
            }
            h1, h2 { color: #fff; text-align: center; }
            .container {
              background-color: #376E6F;
              border-radius: 5px;
              padding: 20px;
              margin-top: 20px;
            }
            .error { color: #ff6b6b; }
            .links {
              text-align: center;
              margin-top: 20px;
            }
            a { color: #4CAF50; }
          </style>
        </head>
        <body>
          <h1>Task Manager</h1>
          
          <div class="container">
            <h2>Login Failed</h2>
            <p class="error">Invalid username or password.</p>
            
            <div class="links">
              <p><a href="/login">Try Again</a></p>
              <p><a href="/register">Register New Account</a></p>
              <p><a href="/">Back to Home</a></p>
            </div>
          </div>
        </body>
        </html>
      `);
    }
    
    // Create a simple token (this would be a session token in a real app)
    const token = crypto.randomBytes(32).toString('hex');
    
    // Redirect to tasks page with token
    res.redirect(`/tasks?token=${token}&userId=${user._id}`);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).send('Something went wrong!');
  }
});

// Register POST handler
app.post('/register', async (req, res) => {
  try {
    const { username, password, confirmPassword } = req.body;
    const db = await connectToDatabase();
    
    // Check if passwords match
    if (password !== confirmPassword) {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Registration Failed - Task Manager</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              max-width: 400px; 
              margin: 0 auto; 
              padding: 20px; 
              background-color: #2F4454; 
              color: #fff; 
            }
            h1, h2 { color: #fff; text-align: center; }
            .container {
              background-color: #376E6F;
              border-radius: 5px;
              padding: 20px;
              margin-top: 20px;
            }
            .error { color: #ff6b6b; }
            .links {
              text-align: center;
              margin-top: 20px;
            }
            a { color: #4CAF50; }
          </style>
        </head>
        <body>
          <h1>Task Manager</h1>
          
          <div class="container">
            <h2>Registration Failed</h2>
            <p class="error">Passwords do not match.</p>
            
            <div class="links">
              <p><a href="/register">Try Again</a></p>
              <p><a href="/">Back to Home</a></p>
            </div>
          </div>
        </body>
        </html>
      `);
    }
    
    // Check if username already exists
    const existingUser = await db.collection('Users').findOne({ username });
    if (existingUser) {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Registration Failed - Task Manager</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              max-width: 400px; 
              margin: 0 auto; 
              padding: 20px; 
              background-color: #2F4454; 
              color: #fff; 
            }
            h1, h2 { color: #fff; text-align: center; }
            .container {
              background-color: #376E6F;
              border-radius: 5px;
              padding: 20px;
              margin-top: 20px;
            }
            .error { color: #ff6b6b; }
            .links {
              text-align: center;
              margin-top: 20px;
            }
            a { color: #4CAF50; }
          </style>
        </head>
        <body>
          <h1>Task Manager</h1>
          
          <div class="container">
            <h2>Registration Failed</h2>
            <p class="error">Username already exists.</p>
            
            <div class="links">
              <p><a href="/register">Try Again</a></p>
              <p><a href="/login">Login</a></p>
              <p><a href="/">Back to Home</a></p>
            </div>
          </div>
        </body>
        </html>
      `);
    }
    
    // Create new user
    const result = await db.collection('Users').insertOne({
      username,
      password: hashPassword(password),
      createdAt: new Date()
    });
    
    // Create a simple token (this would be a session token in a real app)
    const token = crypto.randomBytes(32).toString('hex');
    
    // Redirect to tasks page with token
    res.redirect(`/tasks?token=${token}&userId=${result.insertedId}`);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).send('Something went wrong!');
  }
});

// Tasks page (protected route)
app.get('/tasks', async (req, res) => {
  // Simple auth check - in a real app, validate the token
  const { token, userId } = req.query;
  
  if (!token || !userId) {
    return res.redirect('/login');
  }
  
  try {
    const db = await connectToDatabase();
    
    // Get user info
    const user = await db.collection('Users').findOne({ _id: new ObjectId(userId) });
    
    if (!user) {
      return res.redirect('/login');
    }
    
    // Get tasks for this user
    const tasks = await db.collection('Tasks')
      .find({ userId: userId })
      .toArray();
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Your Tasks - Task Manager</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            max-width: 800px; 
            margin: 0 auto; 
            padding: 20px; 
            background-color: #2F4454; 
            color: #fff; 
          }
          h1, h2 { color: #fff; }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            border-bottom: 1px solid #4A6670;
            padding-bottom: 10px;
          }
          .task { 
            border: 1px solid #ddd; 
            padding: 15px; 
            margin-bottom: 15px; 
            border-radius: 5px; 
            background-color: #376E6F; 
            color: #fff;
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
            border-radius: 4px;
            text-decoration: none;
          }
          .delete-btn { background-color: #f44336; }
          .logout-btn { background-color: #f44336; }
          .task-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            margin-top: 10px;
          }
          .empty-list {
            text-align: center;
            margin: 30px 0;
            font-style: italic;
            color: #9e9e9e;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Your Tasks</h1>
          <div>
            <span>Welcome, ${user.username}</span>
            <a href="/" class="btn logout-btn">Logout</a>
          </div>
        </div>
        
        <div class="tasks-container">
          ${tasks.length === 0 ? 
            '<p class="empty-list">You don\'t have any tasks yet. Create one below!</p>' : 
            tasks.map(task => `
              <div class="task">
                <h3>${task.title}</h3>
                <p>${task.description}</p>
                <p><strong>Status:</strong> ${task.completed ? 'Completed' : 'Pending'}</p>
                <div class="task-actions">
                  <form action="/toggle-task/${task._id}?token=${token}&userId=${userId}" method="POST">
                    <button type="submit">${task.completed ? 'Mark as Pending' : 'Mark as Completed'}</button>
                  </form>
                  <form action="/delete-task/${task._id}?token=${token}&userId=${userId}" method="POST">
                    <button type="submit" class="delete-btn">Delete</button>
                  </form>
                </div>
              </div>
            `).join('')
          }
        </div>
        
        <h2>Add New Task</h2>
        <form action="/add-task?token=${token}&userId=${userId}" method="POST">
          <div>
            <label for="title">Title:</label>
            <input type="text" id="title" name="title" required>
          </div>
          <div>
            <label for="description">Description:</label>
            <textarea id="description" name="description" rows="4" required></textarea>
          </div>
          <button type="submit">Add Task</button>
        </form>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Something went wrong!');
  }
});

// Add a new task
app.post('/add-task', async (req, res) => {
  const { token, userId } = req.query;
  
  if (!token || !userId) {
    return res.redirect('/login');
  }
  
  try {
    const { title, description } = req.body;
    const db = await connectToDatabase();
    
    await db.collection('Tasks').insertOne({
      title,
      description,
      completed: false,
      userId: userId,
      createdAt: new Date()
    });
    
    res.redirect(`/tasks?token=${token}&userId=${userId}`);
  } catch (error) {
    console.error('Error adding task:', error);
    res.status(500).send('Error adding task');
  }
});

// Toggle task completion status
app.post('/toggle-task/:id', async (req, res) => {
  const { token, userId } = req.query;
  
  if (!token || !userId) {
    return res.redirect('/login');
  }
  
  try {
    const taskId = req.params.id;
    const db = await connectToDatabase();
    
    // Get current task
    const task = await db.collection('Tasks').findOne({ 
      _id: new ObjectId(taskId),
      userId: userId
    });
    
    if (!task) {
      return res.redirect(`/tasks?token=${token}&userId=${userId}`);
    }
    
    // Toggle completion status
    await db.collection('Tasks').updateOne(
      { _id: new ObjectId(taskId) },
      { $set: { completed: !task.completed } }
    );
    
    res.redirect(`/tasks?token=${token}&userId=${userId}`);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).send('Error updating task');
  }
});

// Delete task
app.post('/delete-task/:id', async (req, res) => {
  const { token, userId } = req.query;
  
  if (!token || !userId) {
    return res.redirect('/login');
  }
  
  try {
    const taskId = req.params.id;
    const db = await connectToDatabase();
    
    await db.collection('Tasks').deleteOne({ 
      _id: new ObjectId(taskId),
      userId: userId
    });
    
    res.redirect(`/tasks?token=${token}&userId=${userId}`);
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).send('Error deleting task');
  }
});

// Keep original routes for backward compatibility
app.get('/say/:name', function(req, res) {
  res.send('Hello ' + req.params.name + '!');
});

app.get('/api/mongo/:item', async function(req, res) {
  try {
    const db = await connectToDatabase();
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
async function initDatabase() {
  try {
    const db = await connectToDatabase();
    
    // Ensure collections exist
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    // Create Users collection if it doesn't exist
    if (!collectionNames.includes('Users')) {
      await db.createCollection('Users');
      console.log('Created Users collection');
    }
    
    // Create Tasks collection if it doesn't exist
    if (!collectionNames.includes('Tasks')) {
      await db.createCollection('Tasks');
      console.log('Created Tasks collection');
    }
    
    console.log('Database initialized');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

// Start server
app.listen(port, async () => {
  console.log(`Server started at http://localhost:${port}`);
  await initDatabase();
});

// Close MongoDB connection when the app is terminated
process.on('SIGINT', async () => {
  await client.close();
  console.log('MongoDB connection closed');
  process.exit(0);
});
