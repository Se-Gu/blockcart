import React from 'react';
import { View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { useToast } from '../components/ToastProvider';

// This is a test component to demonstrate error handling
// You can add this to any screen temporarily to test the error handling system
export default function ErrorHandlingTest() {
  const { handleError } = useErrorHandler({ context: "Error Handling Test" });
  const { showError, showSuccess, showWarning, showInfo } = useToast();

  const testSupabaseError = () => {
    // Simulate the exact error format you mentioned
    const mockSupabaseError = {
      code: "42703",
      details: null,
      hint: null,
      message: "column receipts_1.store_name does not exist"
    };
    
    handleError(mockSupabaseError, "Testing database error");
  };

  const testGenericError = () => {
    const mockError = new Error("Something went wrong with the network connection");
    handleError(mockError, "Testing generic error");
  };

  const testToastTypes = () => {
    showSuccess("This is a success message!");
    setTimeout(() => showWarning("This is a warning message!"), 1000);
    setTimeout(() => showInfo("This is an info message!"), 2000);
    setTimeout(() => showError("This is an error message!"), 3000);
  };

  return (
    <Card style={{ margin: 16, padding: 16 }}>
      <Text variant="titleMedium" style={{ marginBottom: 16 }}>
        Error Handling Test
      </Text>
      
      <View style={{ gap: 12 }}>
        <Button 
          mode="outlined" 
          onPress={testSupabaseError}
        >
          Test Supabase Error (42703)
        </Button>
        
        <Button 
          mode="outlined" 
          onPress={testGenericError}
        >
          Test Generic Error
        </Button>
        
        <Button 
          mode="outlined" 
          onPress={testToastTypes}
        >
          Test All Toast Types
        </Button>
      </View>
    </Card>
  );
}
