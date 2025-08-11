export default function handler(req, res) {
  res.status(200).json({ 
    message: 'Unified dashboard is deployed!',
    timestamp: new Date().toISOString()
  });
}