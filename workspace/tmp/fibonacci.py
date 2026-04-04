#!/usr/bin/env python3

def fibonacci(n):
    """
    计算斐波那契数列的前n项
    """
    if n <= 0:
        return []
    elif n == 1:
        return [0]
    elif n == 2:
        return [0, 1]
    
    fib_sequence = [0, 1]
    for i in range(2, n):
        fib_sequence.append(fib_sequence[i-1] + fib_sequence[i-2])
    
    return fib_sequence

if __name__ == "__main__":
    import sys
    
    # 默认计算前10项
    n = 10
    
    # 如果命令行参数提供了n的值，使用提供的值
    if len(sys.argv) > 1:
        try:
            n = int(sys.argv[1])
            if n < 0:
                print("请输入非负整数")
                sys.exit(1)
        except ValueError:
            print("请输入有效的整数")
            sys.exit(1)
    
    result = fibonacci(n)
    print(f"斐波那契数列前{n}项：")
    print(result)
    
    # 计算前1项（题目要求）
    if n >= 1:
        first_1 = fibonacci(1)
        print(f"\n前1项的结果：{first_1}")