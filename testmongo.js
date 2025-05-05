const { MongoClient, ObjectId } = require("mongodb");
// The uri string must be the connection string for the database (obtained on Atlas).
const uri = "mongodb+srv://danielhall:12345@cluster0.fsylgfp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
// --- This is the standard stuff to get it to work on the browser
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Default route with task management interface
app.get('/', async (req, res) => {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const database = client.db('MyDBexample');
    const tasks = database.collection('Tasks');
    
    // Fetch all existing tasks
    const allTasks = await tasks.find({}).toArray();
    
    // Send HTML response with tasks and form
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Task Manager</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
          h1 { color: #333; }
          .task { border: 1px solid #ddd; padding: 10px; margin-bottom: 10px; border-radius: 5px; }
          .task-complete { background-color: #e8f5e9; }
          .task-incomplete { background-color: #fff; }
          form { margin-top: 20px; border: 1px solid #ddd; padding: 20px; border-radius: 5px; }
          input, textarea { width: 100%; padding: 8px; margin-bottom: 10px; box-sizing: border-box; }
          button { background-color: #4CAF50; color: white; padding: 10px 15px; border: none; cursor: pointer; }
          .actions { margin-top: 10px; }
          .delete-btn { background-color: #f44336; }
          .complete-btn { background-color: #2196F3; }
        </style>
      </head>
      <body>
        <h1>Task Manager</h1>
        
        <h2>Your Tasks</h2>
        <div id="tasks">
          ${allTasks.length === 0 ? '<p>No tasks yet. Add one below!</p>' : ''}
          ${allTasks.map(task => `
            <div class="task ${task.completed ? 'task-complete' : 'task-incomplete'}">
              <h3>${task.title}</h3>
              <p>${task.description}</p>
              <p><strong>Status:</strong> ${task.completed ? 'Completed' : 'Pending'}</p>
              <div class="actions">
                <form action="/complete/${task._id}" method="POST" style="display: inline;">
                  <button type="submit" class="complete-btn">${task.completed ? 'Mark Incomplete' : 'Mark Complete'}</button>
                </form>
                <form action="/delete/${task._id}" method="POST" style="display: inline;">
                  <button type="submit" class="delete-btn">Delete</button>
                </form>
              </div>
            </div>
          `).join('')}
        </div>
        
        <h2>Add New Task</h2>
        <form action="/add-task" method="POST">
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
  } finally {
    await client.close();
  }
});

// Keeping the original route for backward compatibility
app.get('/say/:name', function(req, res) {
  res.send('Hello ' + req.params.name + '!');
});

// Route to access database by partID (keeping your original route)
app.get('/api/mongo/:item', async function(req, res) {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const database = client.db('MyDBexample');
    const parts = database.collection('MyStuff');
    
    const query = { partID: req.params.item };
    const part = await parts.findOne(query);
    
    console.log(part);
    res.send('Found this: ' + JSON.stringify(part));
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Something went wrong!');
  } finally {
    await client.close();
  }
});

// Add a new task
app.post('/add-task', async (req, res) => {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const database = client.db('MyDBexample');
    const tasks = database.collection('Tasks');
    
    await tasks.insertOne({
      title: req.body.title,
      description: req.body.description,
      completed: false,
      createdAt: new Date()
    });
    
    res.redirect('/');
  } catch (error) {
    console.error('Error adding task:', error);
    res.status(500).send('Error adding task');
  } finally {
    await client.close();
  }
});

// Toggle task completion status
app.post('/complete/:id', async (req, res) => {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const database = client.db('MyDBexample');
    const tasks = database.collection('Tasks');
    
    const task = await tasks.findOne({ _id: new ObjectId(req.params.id) });
    
    await tasks.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { completed: !task.completed } }
    );
    
    res.redirect('/');
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).send('Error updating task');
  } finally {
    await client.close();
  }
});

// Delete a task
app.post('/delete/:id', async (req, res) => {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const database = client.db('MyDBexample');
    const tasks = database.collection('Tasks');
    
    await tasks.deleteOne({ _id: new ObjectId(req.params.id) });
    
    res.redirect('/');
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).send('Error deleting task');
  } finally {
    await client.close();
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server started at http://localhost:${port}`);
});
